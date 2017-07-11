var models = {
	symbolds6707: {
		/*
			Example of a `1 rule that types Win+R, cmd.exe, the barcode, then enter
			"^FNC380",			// erase all rules
			"^FNC37B1211",		// begin new rule
			"^FNC36C201",		// specific string at start (max 8)
			"^FNC3B60",			// `
			"^FNC3B31",			// 1
			"^FNC3B+",			// end of message
			"^FNC330C0D20063",	// specify pause duration
			"^FNC3A1",			// 1
			"^FNC3A0",			// 0 (1.0 second delay)
			"^FNC36A144352",	// send Win + R
			"^FNC36A118",		// send pause
			"^FNC3B63",			// c
			"^FNC3B6D",			// m
			"^FNC3B64",			// d
			"^FNC36A14470D",	// send enter
			"^FNC36A118",		// send pause
			"^FNC36A143302",	// skip ahead 2 characters (ignoring `1 at start)
			"^FNC36A110",		// send all data that remains in barcode
			"^FNC36A14470D",	// send enter
			"^FNC34"			// save rule
		*/

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
					enterconfig: "6C200",
					exitconfig: "",
					prefix: "B",
					postfix: ""
				},
				stringatstart: {
					type: "charmap",
					sendendmessage: true,
					enterconfig: "6C201",
					exitconfig: "",
					prefix: "B",
					postfix: ""
				},
				stringsearch: {
					type: "charmap",
					sendendmessage: true,
					enterconfig: "6C202",
					exitconfig: "",
					prefix: "B",
					postfix: ""
				}
			},
			actions: {
				sendtext: {
					type: "charmap", // each char in input creates a new barcode
					prefix: "B"
				},
				sendcontrol: {
					type: "multiple", // each char in input creates a new barcode, runs process with one char
					sendendmessage: true,
					prefix: "6A1441",
					process: function(input, adf, callback) { // TODO: change this to callback instead of return
						// example output: 2=00 A=01 B=02 Z=1A [=1B
						// non-alphabet
						if (input == "2") callback("00");
						if (input == "[") callback("1B");
						if (input == "\\") callback("1C");
						if (input == "]") callback("1D");
						if (input == "6") callback("1E");
						if (input == "-") callback("1F");
						
						input = input.toUpperCase().charCodeAt(0); // convert to ASCII code
						if (input >= 65 && input <= 90) { // A-Z
							callback(pad((input - 64).toString(16), 2, "0")); // convert shifted ASCII to hex
						}
					}
				},
				pauseduration: {
					type: "single",
					enterconfig: "30C0D20063",
					prefix: "A",
					process: function(input, adf, callback) {
						// 1.0 duration would be A1, A0
						callback(Math.floor(input));
						callback(Math.floor((input % 1).toFixed(1) * 10));
					}
				},
				sendgui: {
					type: "charmap",
					prefix: "6A1443"
				},
				sendpause: "6A118",
				sendenter: "6A14470D",
				sendremaining: "6A110",
				skipcharacters: {
					type: "single",
					prefix: "6A1433",
					process: function(input, adf, callback) {
						callback(pad(input, 2, "0"));
					}
				}
			},
			mapcharacter: {
				type: "multiple", // each char in input creates a new barcode, runs process with one char
				process: function(input, adf, callback) { // ADF doesn't take normal keys...
					// example output: space=20 #=23 $=24 +=2B
					// straight hex of ASCII
					callback(pad(input.charCodeAt(0).toString(16).toUpperCase(), 2, "0"));
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