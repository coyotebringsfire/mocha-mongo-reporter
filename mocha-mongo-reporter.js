var debug=require('debug')('mocha:mongoreporter'),
    Q=require('q'),
    mongo=require('mongodb'),
    dateFormat=require('dateFormat'), now;

module.exports = mocha_mongo_reporter;

function mocha_mongo_reporter(runner) {
  var db = null;

  var passes = [];
  var failures = [];

  var runnerEnd=Q.defer(), 
      mongoConnect=Q.defer();

  var mongoUrl=process.env['MONGOURL'];
  debug("connecting to %s", mongoUrl);

  if(!(this instanceof mocha_mongo_reporter)) {
    return new mocha_mongo_reporter(runner);
  }

  mongo.MongoClient.connect(mongoUrl, function(err, _db) {
    if(err) {
      mongoConnect.reject();
      throw err;
    }
    debug("connected to mongo");
    mongoConnect.resolve({});
    db = _db;
  });

  runner.on('pass', function(test){
    now=new Date();
    passes.push({"timestamp":dateFormat(now, "isoDateTime", true), suite:test.fullTitle().match(new RegExp("(.*) "+test.title))[1], test:test.title, duration:test.duration, pass:true});
  });

  runner.on('fail', function(test, err){
    now=new Date();
    failures.push({"timestamp":dateFormat(now, "isoDateTime", true), suite:test.fullTitle().match(new RegExp("(.*) "+test.title))[1], test:test.title, duration:test.duration, pass:false, err:err.message});
  });

  runner.on('end', function(){
    debug("runner.end");
    runnerEnd.resolve({});
  });

  Q.all([runnerEnd.promise, mongoConnect.promise]).then( updateDB, function onRejectedPromise() {
    debug("error connecting to mongo");
  });

  function updateDB() {
    var allDeferreds=[];
    debug("updating db, %s %s", passes, failures);
    passes.concat(failures).forEach(function saveTestResults(test) {
      var deferred=Q.defer();
      allDeferreds.push(deferred.promise);
      debug("testrun to insert: %s", JSON.stringify(test));
      db.collection("testruns").insert(test, function mongoInsertCallback(err, results) {
        if(err) deferred.reject(err);
        deferred.resolve(results);
      });
    });
    Q.all(allDeferreds).then(function() {
      db.close();
      process.exit(failures.length);
    });
  }
}