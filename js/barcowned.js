$(function  () {
  $("ol.example").sortable();
});

var bw;
var barcodeNumber = 0;

var config = {
	bwippoptions: { // these apply globally and override model settings
		includetext: true
	}
};

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

var models = {
	symbolds6707: {
		name: "Symbol DS6707",
		autodelay: 500, // roughly how fast we can send barcodes when autoscanning
		setup: {
			symbology: "code128",
			prefix: "^FNC3",
			postfix: "",
			enterconfig: "",
			exitconfig: "",
			options: {
				scanpresentation: "2050207", // Presentation mode scanning ("Blink")
				enableparameterscanning: "1040601", // Enable parameter scanning
				mobilephonedecode: [
					"N02CC03", // Mobile Phone Decode Enable
					"N02D60D", // Mobile Phone Decode High Aggressive
				],
				eraseallrules: "80" // Erase all rules
			}
		},
		adf: {
			symbology: "code128",
			prefix: "^FNC3",
			postfix: "",
			enterconfig: "7B1211", // begin new rule
			exitconfig: "4", // save rule
			endmessage: "B+", // used after sending text
			criteria: {
				stringatposition: {
					type: "charmap",
					sendendmessage: true,
					prefix: "6C200",
					postfix: ""
				},
				stringatstart: {
					type: "charmap",
					sendendmessage: true,
					prefix: "6C201",
					postfix: ""
				},
				stringsearch: {
					type: "charmap",
					sendendmessage: true,
					prefix: "6C202",
					postfix: ""
				}
			},
			actions: {
				sendtext: {
					type: "charmap", // each char in input creates a new barcode
				},
				sendcontrol: {
					type: "multiple", // each char in input creates a new barcode, runs process with one char
					sendendmessage: true,
					process: function(input) { // TODO: change this to callback instead of return
						var prefix = "6A1441";
						// example output: 2=00 A=01 B=02 Z=1A [=1B
						
						// non-alphabet
						if (input == "2") return prefix + "00";
						if (input == "[") return prefix + "1B";
						if (input == "\\") return prefix + "1C";
						if (input == "]") return prefix + "1D";
						if (input == "6") return prefix + "1E";
						if (input == "-") return prefix + "1F";
						
						input = input.toUpperCase().charCodeAt(0); // convert to ASCII code
						if (input >= 65 && input <= 90) { // A-Z
							return prefix + pad((input - 64).toString(16), 2, "0"); // wait need to convert to hex
						}
					}
				}
			},
			mapcharacter: {
				type: "multiple", // each char in input creates a new barcode, runs process with one char
				process: function(input) { // ADF doesn't take normal keys...
					// example output: space=20 #=23 $=24 +=2B
					// straight hex of ASCII
					return "B" + pad(input.toString(16), 2, "0");
				}
			}
			
			
		},
		bwippoptions: {
			parsefnc: true,
			includetext: true // temp until bwipp inheritance added
		}
		
		// "Using ADF with longer bar codes transmits the bar code in segments of length 252 or less (depending on the host selected), and applies the rule to each segment."
		// TODO: Parameter to define split support
	}
};

var example = {
	options: [
		"eraseallrules"
	],
	adf: [
		{
			criteria: [
				["stringatstart", "`1"]
			],
			actions: [
				["sendtext", "test"],
				["sendcontrol", "S"]
			]
		}
	],
	payload: [
		"`1calc.exe",
		"8*17*39103"
	]
};

/*
	Example of a `1 rule that types Win+R, cmd.exe, the barcode, then enter

	"^FNC37B1211", // begin new rule
	"^FNC36C201", // specific string at start (max 8)
	"^FNC3B60", // `
	"^FNC3B31", // 1
	"^FNC3B+", // end of message
	"^FNC330C0D20063", // specify pause duration
	"^FNC3A1", "^FNC3A5", // 1.0 second delay
	"^FNC36A144352", // send Win + R
	"^FNC36A118", // send pause
	"^FNC3B63", // c
	"^FNC3B6D", // m
	"^FNC3B64", // d
	"^FNC36A14470D", // send enter
	"^FNC36A118", // send pause
	"^FNC36A143302", // skip ahead 2 characters (ignoring `1 at start)
	"^FNC36A110", // send all data that remains
	"^FNC36A14470D", // send enter
	"^FNC3B+", // end of message
	"^FNC34" // save rule
*/

function addBarcode(text, symbology, options) {
	var canvas = $("<canvas/>", { id: "barcode-" + barcodeNumber});
	$("#barcodes").append($("<li>").append(canvas));
	var rawcanvas = canvas[0];
	
	bw.bitmap(new Bitmap);
	// bw.scale(2,2); // crashes chrome??
	BWIPP()(bw, symbology, text, options);
	bw.bitmap().show(rawcanvas, "N"); // "normal"
	barcodeNumber++;
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
	
	if (modelfunc.type == "single") { // function does everything
		callback(prefix + modelfunc.process(params, adf) + postfix);
	} else if (modelfunc.type == "charmap") {
		runModelFunction(params, adf.mapcharacter, adf, function callbackextra(code) {
			// make sure the prefix and postfix make it into the recursive function
			callback(prefix + code + postfix);
		});
	} else if (modelfunc.type == "multiple") {
		// we have to run for each character
		// we only do this for the first param because when else would the madness stop?
		var chars = params[0];
		for (var i = 0; i < chars.length; i++) {
			callback(prefix + modelfunc.process(chars[i], params, adf) + postfix);
		}
	}
	
	if (modelfunc.sendendmessage) {
		// in most scenarios I think there should be no prefix/postfix here,
		// as endmessage is not specific to a single criteria/action
		callback(adf.endmessage);
	}
}
	

// returns an array of objects with barcode strings and bwipp properties
function generateBarcodes(model, script) {
	var codes = [];
	
	if (model.setup) {
		var currentsymbology;
		if (model.symbology)
			currentsymbology = model.symbology;
		if (model.setup.symbology)
			currentsymbology = model.setup.symbology;
		
		// TODO: combine multiple bwippoptions with precedence
		var currentbwippoptions = model.bwippoptions;
		
		optionalArray(model.setup.enterconfig, function(code) {
			codes.push({
				barcode: model.setup.prefix + code + model.setup.postfix,
				bwippoptions: currentbwippoptions,
				symbology: currentsymbology
			});
		});
		
		// do we have options provided?
		optionalArray(script.options, function(input) {
			// does the option provided match with a known option in model.setup?
			if (model.setup.options[input]) {
				// option in model.setup may be an array
				optionalArray(model.setup.options[input], function (code) {
					codes.push({
						barcode: model.setup.prefix + code + model.setup.postfix,
						bwippoptions: currentbwippoptions,
						symbology: currentsymbology
					});
				});
			} else {
				console.log("Unknown script option: " + input);
			}
		});
		
		optionalArray(model.setup.exitconfig, function(code) {
			codes.push({
				barcode: model.setup.prefix + code + model.setup.postfix,
				bwippoptions: currentbwippoptions,
				symbology: currentsymbology
			});
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
				codes.push({
					barcode: model.adf.prefix + input + model.adf.postfix,
					bwippoptions: currentbwippoptions,
					symbology: currentsymbology
				});
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
						codes.push({
							barcode: model.adf.prefix + code + model.adf.postfix,
							bwippoptions: currentbwippoptions,
							symbology: currentsymbology
						});
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
						codes.push({
							barcode: model.adf.prefix + code + model.adf.postfix,
							bwippoptions: currentbwippoptions,
							symbology: currentsymbology
						});
					});
				} else {
					console.log("Unknown action: " + name);
					// fatal error
					return;
				}
			});
			
			optionalArray(model.adf.exitconfig, function(code) {
				codes.push({
					barcode: model.adf.prefix + code + model.adf.postfix,
					bwippoptions: currentbwippoptions,
					symbology: currentsymbology
				});
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
			codes.push({
				barcode: code,
				bwippoptions: currentbwippoptions,
				symbology: currentsymbology
			});
		});
	}
	
	return codes;
}

$(function () {	
	var codes = generateBarcodes(models.symbolds6707, example);
	console.log(codes);
	bw = new BWIPJS(Module, false);
	for (var i = 0; i < codes.length; i++) {
		addBarcode(codes[i].barcode, codes[i].symbology, codes[i].bwippoptions);
	}
	
	/*
	if (script.setup.length > 0) {
		for (var i = 0; i < model.setup.enterconfig.length; i++)
		{
			addBarcode(model.setup.prefix + model.setup.enterconfig[i] + model.setup.postfix, model.setup.symbology, model.bwippoptions);
		}
		for (var i = 0; i < script.setup.length; i++)
		{
			addBarcode(model.setup.prefix + script.setup[i] + model.setup.postfix, model.setup.symbology, model.bwippoptions);
		}
		for (var i = 0; i < model.setup.exitconfig.length; i++)
		{
			addBarcode(model.setup.prefix + model.setup.exitconfig[i] + model.setup.postfix, model.setup.symbology, model.bwippoptions);
		}
	}
	
	for (var i = 0; i < script.replacements.length; i++)
	{
		for (var j = 0; j < script.replacements[i].length; j++)
		{
			addBarcode(script.replacements[i][j],  model.setup.symbology, model.bwippoptions);
		}
	}
	
	for (var i = 0; i < script.payload.length; i++)
	{
		addBarcode(script.payload[i], script.symbology, model.bwippoptions);
	}*/
});