var util = require("util");
var vm = require("vm");
var file = require('fs');

var Sandbox = (function() {
	"use strict";

	function Sandbox(utils_file) {
		this.utils_file = utils_file;
		this.utils_global = {
			exports: {},
			global: {},
			version: "V8 " + process.versions.v8
		};
		this.input_code = null;
	}

	Sandbox.prototype.load_input = function(callback) {
		var input = [];
		var stdin = process.openStdin();
		var self = this;
		
		stdin.on("data", function(data) {
			input.push(data);
		});
		
		stdin.on("end", function() {
			try {
				self.input_code = input.join("");
				callback.call(self);
			} catch (e) {
				Sandbox.report_error(e);
			}
		});
	};

	Sandbox.prototype.run = function() {
		"use strict";
	
		this.load_input(function() {
			var output;
		
			// Run utilities file
			vm.runInNewContext(file.readFileSync(this.utils_file), this.utils_global);
			
			// Execute utilities' run function
			if (typeof this.utils_global.exports.run !== "function")
				throw new Error("The exports.run function is not callable.");
			
			output = this.utils_global.exports.run(this.execute.bind(this));
			
			process.stdout.write(output+"\n");
			process.exit();
		});
	};
	
	Sandbox.prototype.execute = function() {
		if (typeof this.utils_global.global !== "object")
			throw new Error("Expected global to be an object.");

		// We have to remove the Error object's captureStackTrace function
		// or an exploit might be possible in V8 - thanks to `Benvie`
		var context = vm.createContext(this.utils_global.global);
		vm.runInContext("delete Error.captureStackTrace;", context, "irc");

		return vm.runInContext(this.input_code, context, "irc");
	};
	
	Sandbox.report_error = function(error) {
		process.stdout.write(
				JSON.stringify(
				{"data": {},
				 "error": "Internal Error: V8 sandbox, "+error,
				 "result": "undefined"}
			)+"\n");
		process.exit();
	}
	
	Sandbox.main = function(argv) {
		try {
			if (argv[2]) {
				var sandbox = new Sandbox(argv[2]);
				sandbox.run();
			} else {
				throw new Error("Required argument for utilities file.");
			}
		} catch (e) {
			Sandbox.report_error(e);
		}
	};

	return Sandbox;
}());

Sandbox.main(process.argv);
