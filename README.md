#mongoreporter
##Description
A reporter for mocha that stores results directly to a mongo db

##Usage
```sh
$ npm install mongoreporter
```
```sh
$ MONGOURL=mongodb://dbuser:dbpassword@dbhost:dbport/dbname mocha -R mongoreporter
```
```sh
process.env["MONGOURL"]="mongodb://dbuser:dbpassword@dbhost:dbport/dbname mocha -R mongoreporter";
var mocha = new Mocha({
    ui: 'bdd',
    reporter: "mongoreporter"
});
```