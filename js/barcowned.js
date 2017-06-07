/*
	TODO: implement this
	var config = {
		bwippoptions: { // these apply globally and override model settings
			includetext: true
		}
	};
*/

// https://stackoverflow.com/a/16122676/415943
function pad(string, length, pad_char, append) {
	string = string.toString();
	length = parseInt(length) || 1;
	pad_char = pad_char || ' ';

	while (string.length < length) {
		string = append ? string+pad_char : pad_char+string;
	}
	return string;
}

function arrayEmpty(array) {
	if (!array)
		return true;
	if (array.length > 0)
		return false;
	return true;
}

// run something multiple times if it's an array
// or just once if it's not
// or never if it's undefined
// doesn't return anything, you do it all in callback
function optionalArray(input, callback) {
	if (input) {
		if (input.constructor == Array) {
			if (!arrayEmpty(input)) {
				for (var i = 0; i < input.length; i++) {
					callback(input[i]);
				}
			}
		} else {
			callback(input);
		}
	}
}

// implements the function + metadata structure in model'
// calls callback with every function
// types: charmap, multiple, single
function runModelFunction(params, modelfunc, adf, callback) {
	var prefix = "";
	if (modelfunc.prefix)
		prefix = modelfunc.prefix;
	
	var postfix = "";
	if (modelfunc.postfix)
		postfix = modelfunc.postfix;
	
	if (modelfunc.enterconfig)
		callback(modelfunc.enterconfig); // don't think this should be prefixed
	
	var param = "";
	if (params.length > 0)
		param = params[0]; // we only take the first one
	
	if (modelfunc.constructor == String || modelfunc.type == "static") { // it's just a string, send that
		callback(prefix + modelfunc + postfix);
	} else if (modelfunc.type == "single") { // function does everything
		modelfunc.process(param, adf, function callbackextra(code) {
			// make sure the prefix and postfix make it in
			callback(prefix + code + postfix);
		});
	} else if (modelfunc.type == "charmap") {
		for (var i = 0; i < param.length; i++) {
			runModelFunction(param[i], adf.mapcharacter, adf, function callbackextra(code) {
				// make sure this prefix and postfix make it in
				// the mapcharacter may have prefix/postfix too, that's handled by the recursion
				callback(prefix + code + postfix);
			});
		}
	} else if (modelfunc.type == "multiple") {
		// we have to run for each character
		for (var i = 0; i < param.length; i++) {
			modelfunc.process(param[i], adf, function callbackextra(code) {
				// make sure the prefix and postfix make it in
				callback(prefix + code + postfix);
			});
		}
	}
	
	if (modelfunc.sendendmessage) {
		// in most scenarios I think there should be no prefix/postfix here,
		// as endmessage is not specific to a single criteria/action
		callback(adf.endmessage);
	}
	
	if (modelfunc.exitconfig)
		callback(modelfunc.exitconfig); // don't think this should be prefixed
}
	

// returns an array of objects with barcode strings and bwipp properties
function generateBarcodes(model, script, callback) {
	if (model.setup) {
		var currentsymbology;
		if (model.symbology)
			currentsymbology = model.symbology;
		if (model.setup.symbology)
			currentsymbology = model.setup.symbology;
		
		// TODO: combine multiple bwippoptions with precedence
		var currentbwippoptions = model.bwippoptions;
		
		optionalArray(model.setup.enterconfig, function(code) {
			callback(model.setup.prefix + code + model.setup.postfix, currentsymbology, currentbwippoptions);
		});
		
		// do we have options provided?
		optionalArray(script.options, function(input) {
			// does the option provided match with a known option in model.setup?
			if (model.setup.options[input]) {
				// option in model.setup may be an array
				optionalArray(model.setup.options[input], function (code) {
					callback(model.setup.prefix + code + model.setup.postfix, currentsymbology, currentbwippoptions);
				});
			} else {
				console.log("Unknown script option: " + input);
			}
		});
		
		optionalArray(model.setup.exitconfig, function(code) {
			callback(model.setup.prefix + code + model.setup.postfix, currentsymbology, currentbwippoptions);
		});
	}
	
	if (model.adf) {
		var currentsymbology;
		if (model.symbology)
			currentsymbology = model.symbology;
		if (model.adf.symbology)
			currentsymbology = model.adf.symbology;
		
		// TODO: combine multiple bwippoptions with precedence
		var currentbwippoptions = model.bwippoptions;
		
		optionalArray(script.adf, function (rule) {
			optionalArray(model.adf.enterconfig, function(input) {
				callback(model.adf.prefix + input + model.adf.postfix, currentsymbology, currentbwippoptions);
			});
			
			// technically you don't need criteria, omit it and every barcode runs this rule
			optionalArray(rule.criteria, function(input) {
				// does the criteria provided match with a known criteria in model.adf?
				var name = input;
				var params = [];
				if (!arrayEmpty(input)) {
					name = input[0];
					// copy other params to new array
					for (var i = 1; i < input.length; i++) {
						params.push(input[i]);
					}
				}
				
				if (model.adf.criteria[name]) {
					// run the func in criteria definition
					runModelFunction(params, model.adf.criteria[name], model.adf, function(code) {
						callback(model.adf.prefix + code + model.adf.postfix, currentsymbology, currentbwippoptions);
					});
				} else {
					console.log("Unknown criteria: " + name);
					// fatal error
					return;
				}
			});
			
			// actions are basically the same thing as criteria
			optionalArray(rule.actions, function(input) {
				// does the action provided match with a known action in model.adf?
				var name = input;
				var params = [];
				if (!arrayEmpty(input)) {
					name = input[0];
					// copy other params to new array
					for (var i = 1; i < input.length; i++) {
						params.push(input[i]);
					}
				}
				
				if (model.adf.actions[name]) {
					// run the func in action definition
					runModelFunction(params, model.adf.actions[name], model.adf, function(code) {
						callback(model.adf.prefix + code + model.adf.postfix, currentsymbology, currentbwippoptions);
					});
				} else {
					console.log("Unknown action: " + name);
					return;
				}
			});
			
			optionalArray(model.adf.exitconfig, function(code) {
				callback(model.adf.prefix + code + model.adf.postfix, currentsymbology, currentbwippoptions);
			});
			
		});
	}
	
	if (script.payload) {
		var currentsymbology;
		if (model.symbology)
			currentsymbology = model.symbology;
		if (script.symbology)
			currentsymbology = script.symbology;
		
		// TODO: combine multiple bwippoptions with precedence
		var currentbwippoptions = model.bwippoptions;
		
		optionalArray(script.payload, function(code) {
			callback(code, currentsymbology, currentbwippoptions);
		});
	}
}