var debug       = require('debug')('mocha:mongoreporter'),
    mongo       = require('mongodb'),
    dateFormat  = require('dateFormat'), now;
    os          = require('os'),
    snap        = require('env-snapshot').EnvSnapshot();

module.exports = mocha_mongo_reporter;

function mocha_mongo_reporter(runner, options) {
  var db = null;

  var passes = [];
  var failures = [];

  var meta = { 
    user: snap.process_env["USER"], 
    host: snap.os_hostname, 
    type: snap.os_type, 
    platform: snap.os_platform, 
    arch: snap.os_arch, 
    release: snap.os_release, 
    totalmem: snap.os_totalmem, 
    freemem: snap.os_freemem, 
    cpus: snap.os_cpus
  };

  var mongoUrl=( options && options.url ) || process.env['MONGOURL'];
  debug("connecting to %s", mongoUrl);

  var runnerEnd = new Promise( function(resolve, reject) {
    runner.on('end', function(){
      debug("runner.end");
      resolve("runner ended");
    });
  }), mongoConnect = new Promise( function(resolve, reject) {
    debug("connecting to %j", mongoUrl);
    mongo.MongoClient.connect(mongoUrl, function(err, _db) {
      if(err) {
        debug("error connecting to mongo %j", err);
        reject(err);
        throw err;
      }
      db = _db;
      debug("connected to mongo");
      resolve({});
    });
  });

  if(!(this instanceof mocha_mongo_reporter)) {
    return new mocha_mongo_reporter(runner);
  }

  runner.on('pass', function(test){
    now=new Date();
    meta.timestamp=dateFormat(now, "isoDateTime", true);
    passes.push({ 
      suite:test.fullTitle().match(new RegExp("(.*) "+test.title))[1], 
      test:test.title, 
      duration:test.duration, 
      pass:true, 
      meta:meta
    });
  });

  runner.on('fail', function(test, err){
    now=new Date();
    meta.timestamp=dateFormat(now, "isoDateTime", true);
    failures.push({
      suite:test.fullTitle().match(new RegExp("(.*) "+test.title))[1], 
      test:test.title, 
      duration:test.duration, 
      pass:false, 
      err:err.message, 
      meta:meta
    });
  });

  runnerEnd.then( function() { 
    debug("runnerEnd"); 
    updateDB(); 
  }, function onRejectedPromise(err) {
    debug("error connecting to mongo : %s", err.message);
  });

  function updateDB() {
    var allDeferreds=[];
    debug("updating db");
    passes.concat(failures).forEach(function saveTestResults(test) {
      var _test = test;
      var deferred = new Promise(function(resolve, reject) {
        debug("testrun to insert: %s", JSON.stringify(_test));
        if(options.meta===false)
          _test.meta=undefined;
        db.collection("testruns").insert(_test, function mongoInsertCallback(err, results) {
          if(err) return reject(err);
          resolve(results);
        });
      });
      allDeferreds.push(deferred);
    });
    Promise.all(allDeferreds).then(function allDBUpdatesDone() {
      db.close();
      process.exit(failures.length);
    }, function onDBErr(err) {
      debug("error saving to mongo: %s", err.message);
      db.close();
      process.exit(failures.length);
    });
  }
}