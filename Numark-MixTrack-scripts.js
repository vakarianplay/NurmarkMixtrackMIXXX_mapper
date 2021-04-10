function NumarkMixTrack() {}


NumarkMixTrack.init = function(id) {	// called when the MIDI device is opened & set up
	
NumarkMixTrack.id = id;	// Store the ID of this device for later use
	
NumarkMixTrack.directoryMode = false;
		
NumarkMixTrack.scratchMode = [false, false];

NumarkMixTrack.scratching = [false, false];

NumarkMixTrack.KeyIsLocked = [false,false];
		
NumarkMixTrack.manualLooping = [false, false];

	
NumarkMixTrack.leds = [
		// Common
		{ "directory": 0x73, "file": 0x72 },
		// Deck 1                      
		{ "rate": 0x70, "scratchMode": 0x48, "keylock": 0x51, "manualLoop": 0x61, "loopIn": 0x53, "loopOut": 0x54, "reLoop": 0x55, "play": 0x3B, "cue": 0x33, "sync": 0x40, "stutter": 0x4A, "FX": 0x63, "Bank1": 0x59, "Bank2": 0x5a, "Bank3": 0x5b, "Bank4": 0x5c},
		// Deck 2
		{ "rate": 0x71, "scratchMode": 0x50, "keylock": 0x52, "manualLoop": 0x62, "loopIn": 0x56, "loopOut": 0x57, "reLoop": 0x58, "play": 0x42, "cue": 0x3C, "sync": 0x47, "stutter": 0x4C, "FX": 0x64, "Bank1": 0x5d, "Bank2": 0x5e, "Bank3": 0x5f, "Bank4": 0x60}
	];

	var lowestLED = 0x30;
	var highestLED = 0x73;
	for (var i=lowestLED; i<=highestLED; i++) {
		NumarkMixTrack.setLED(i, false);	// Turn off all the lights
	}
	
	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[0]["file"], true);

	NumarkMixTrack.setLED(NumarkMixTrack.leds[1]["Bank1"], true);
	NumarkMixTrack.setLED(NumarkMixTrack.leds[2]["Bank1"], true);

	engine.connectControl("[Channel1]", "track_samples", "NumarkMixTrack.BlinkOnLoad")
	engine.connectControl("[Channel2]", "track_samples", "NumarkMixTrack.BlinkOnLoad")
	engine.connectControl("[Channel1]", "eject", "NumarkMixTrack.unloadLightsOff")
	engine.connectControl("[Channel2]", "eject", "NumarkMixTrack.unloadLightsOff")

}

NumarkMixTrack.shutdown = function(id) {	// called when the MIDI device is closed
	var lowestLED = 0x30;
	var highestLED = 0x73;
	for (var i=lowestLED; i<=highestLED; i++) {
		NumarkMixTrack.setLED(i, false);	// Turn off all the lights
	}
}



NumarkMixTrack.groupToDeck = function(group) {
	var matches = group.match(/^\[Channel(\d+)\]$/);
	if (matches == null) {
		return -1;
	} else {
		return matches[1];
	}
}

NumarkMixTrack.samplesPerBeat = function(group) {
	// FIXME: Get correct samplerate and channels for current deck
	var sampleRate = 44100;
	var channels = 2;
	var bpm = engine.getValue(group, "file_bpm");
	return channels * sampleRate * 60 / bpm;
}

NumarkMixTrack.setLED = function(value, status) {
	if (status) {
		status = 0x64;
	} else {
		status = 0x00;
	}
	midi.sendShortMsg(0x90, value, status);
}

NumarkMixTrack.selectKnob = function(channel, control, value, status, group) {
	if (value > 63) {
		value = value - 128;
	}
	if (NumarkMixTrack.directoryMode) {
		if (value < 0) {
			for (var i = 0; i < -value; i++) {
				engine.setValue(group, "SelectNextPlaylist", 1);
			}
		} else {
			for (var i = 0; i < value; i++) {
				engine.setValue(group, "SelectPrevPlaylist", 1);
			}
		}
	} else {
		engine.setValue(group, "SelectTrackKnob", -value);
	}
}

NumarkMixTrack.loopIn = function(channel, control, value, status, group) {
        var deck = NumarkMixTrack.groupToDeck(group);
	if (value) {
		if(NumarkMixTrack.manualLooping[deck-1]) {
				// Cut loop to Half
				var start = engine.getValue(group, "loop_start_position");
				var end = engine.getValue(group, "loop_end_position");
				if((start != -1) && (end != -1)) {
					var len = (end - start) / 2;
					engine.setValue(group, "loop_end_position", start + len);
				}
		} else {
			if (engine.getValue(group, "loop_enabled")) {
				engine.setValue(group, "reloop_exit", 1);
				NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["reLoop"],false);
			}
			engine.setValue(group, "loop_in", 1);
			engine.setValue(group, "loop_end_position", -1);
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopIn"],true);
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopOut"],false);
		}
	}
}

NumarkMixTrack.loopOut = function(channel, control, value, status, group) {
        var deck = NumarkMixTrack.groupToDeck(group);
	if (value) {
		var start = engine.getValue(group, "loop_start_position");
		var end = engine.getValue(group, "loop_end_position");
		if(NumarkMixTrack.manualLooping[deck-1]) {
			// Set loop to current Bar (very approximative and would need to get fixed !!!)
			var bar = NumarkMixTrack.samplesPerBeat(group);
			engine.setValue(group,"loop_in",1);
			var start = engine.getValue(group, "loop_start_position");
			engine.setValue(group,"loop_end_position", start + bar);
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopIn"],true);
                        NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopOut"],true);
		} else {
			if (start != -1) {
				if (end != -1) {
					// Loop In and Out set -> call Reloop/Exit
					engine.setValue(group, "reloop_exit", 1);
					NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopIn"],true);
					NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopOut"],true);
					NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["reLoop"],true);
				} else {
					// Loop In set -> call Loop Out
					engine.setValue(group, "loop_out", 1);
					NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["loopOut"],true);
				}
			}
		}
	}
}

NumarkMixTrack.reLoop = function(channel, control, value, status, group) {
        var deck = NumarkMixTrack.groupToDeck(group);
	if (value) {
		if(NumarkMixTrack.manualLooping[deck-1]) {
				// Multiply Loop by Two 
				var start = engine.getValue(group, "loop_start_position");
				var end = engine.getValue(group, "loop_end_position");
				if((start != -1) && (end != -1)) {
					var len = (end - start) * 2;
					engine.setValue(group, "loop_end_position", start + len);
				}
		} else {
			if (engine.getValue(group, "loop_enabled")) {
				NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["reLoop"],false);
			} else {
				var start = engine.getValue(group, "loop_start_position");
				var end = engine.getValue(group, "loop_end_position");
				if( (start != -1) && (end != -1)) {
					// Loop is set ! Light the led
					NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["reLoop"],true);
				}
			}
			engine.setValue(group, "reloop_exit", 1);
		}
	}
}


// If playing, stutters from cuepoint; otherwise jumps to cuepoint and stops
NumarkMixTrack.playFromCue = function(channel, control, value, status, group) {
	
	if (value) {
		if (engine.getValue(group, "play")) {
			engine.setValue(group, "play", 0);
			engine.setValue(group, "cue_gotoandstop", 1);
		} else {
			engine.setValue(group, "cue_preview", 1);
		}
	} else {
		engine.setValue(group, "cue_preview", 0);
	}  
}

NumarkMixTrack.jogWheel = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var adjustedJog = parseFloat(value);
	var posNeg = 1;
	if (adjustedJog > 63) {	// Counter-clockwise
		posNeg = -1;
		adjustedJog = value - 128;
	}
	
	if (NumarkMixTrack.scratching[deck-1])
	{
		engine.setValue(group, "keylock", 0);
		engine.scratchTick(deck, adjustedJog);
	}
	else 
	{
		var gammaInputRange = 23;	// Max jog speed
		var maxOutFraction = 0.5;	// Where on the curve it should peak; 0.5 is half-way
		var sensitivity = 0.3;		// Adjustment gamma
		var gammaOutputRange = 3;	// Max rate change
		if (engine.getValue(group,"play")) {
			adjustedJog = posNeg * gammaOutputRange * Math.pow(Math.abs(adjustedJog) / (gammaInputRange * maxOutFraction), sensitivity);
		} else {
			adjustedJog = gammaOutputRange * adjustedJog / (gammaInputRange * maxOutFraction);
		}
		engine.setValue(group, "jog", adjustedJog);
	}
}


NumarkMixTrack.toggleDirectoryMode = function(channel, control, value, status, group) {
	// Toggle setting and light
	if (value) {
		if (NumarkMixTrack.directoryMode) {
			NumarkMixTrack.directoryMode = false;
		} else {
			NumarkMixTrack.directoryMode = true;
		}
		NumarkMixTrack.setLED(NumarkMixTrack.leds[0]["directory"], NumarkMixTrack.directoryMode);
		NumarkMixTrack.setLED(NumarkMixTrack.leds[0]["file"], !NumarkMixTrack.directoryMode);
	}
}


NumarkMixTrack.toggleScratchMode = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	// Toggle setting and light
	if (value) {
		if (NumarkMixTrack.scratchMode[deck-1]) {
			NumarkMixTrack.scratchMode[deck-1] = false;
		} else {
			NumarkMixTrack.scratchMode[deck-1] = true;
		}
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["scratchMode"], NumarkMixTrack.scratchMode[deck-1]);
	}
}

NumarkMixTrack.WheelTouch = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	if (NumarkMixTrack.scratchMode[deck-1]) {
    if (value) {    // If button up
	

			engine.scratchEnable(deck, 512, 33+1/3, 0.2, (0.2)/32);
			NumarkMixTrack.scratching[deck-1] = true;
    }
    else {    // If button up
	
		engine.scratchDisable(deck);
		if (NumarkMixTrack.KeyIsLocked[deck-1]) {
		engine.setValue(group, "keylock", 1);
		}
		NumarkMixTrack.scratching[deck-1] = false;
	
	

		}
    }
	//}
}



NumarkMixTrack.toggleManualLooping = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);

	// Toggle setting and light
	if (value) {
		if (NumarkMixTrack.manualLooping[deck-1]) {
			NumarkMixTrack.manualLooping[deck-1] = false;
		} else {
			NumarkMixTrack.manualLooping[deck-1] = true;
		}
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["manualLoop"], NumarkMixTrack.manualLooping[deck-1]);
	}
}


NumarkMixTrack.ToggleKeylock = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	// Toggle setting and light
	if (value) {
		if (NumarkMixTrack.KeyIsLocked[deck-1]) {
			engine.setValue(group, "keylock", 0);
			NumarkMixTrack.KeyIsLocked[deck-1] = false;
		} else {
			engine.setValue(group, "keylock", 1);
			NumarkMixTrack.KeyIsLocked[deck-1] = true;
		}
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["keylock"], NumarkMixTrack.KeyIsLocked[deck-1]);
	}
}

NumarkMixTrack.LoadSelected = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
		if (value) {
		if (!engine.getValue(group, "play")) {
			engine.setValue(group, "pregain",1);
			engine.setValue(group, "LoadSelectedTrack", 1);
		}
	}
}



//Brake and Spinback effects -- attached to the pitch bend +/- buttons on each deck.

NumarkMixTrack.brakey = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
    var activate = value > 0;

    if (activate) {
        engine.brake(deck, true, 0.1, 1); // enable brake effect
		print("brake on!");
    }
    else {
        engine.brake(deck, false); // disable brake effect
		print("brake off!");
    }   
	
}

NumarkMixTrack.brakeback = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
    var activate = value > 0;

    if (activate) {
        engine.brake(deck, true, 0.5, -10); // enable brake effect
		print("spinback on!");
    }
    else {
        engine.brake(deck, false); // disable brake effect
		print("spinback off!")
    }   
	
	
}



/* 
	EFFECTS SECTION

	Controls for the top two rows of buttons on each deck:

		Delete, Hot Cue 1-3 select an active Effect Unit (either side can control any of the 4 units), indicated by light.
		Hold the lit button for shift (see below for shift behavior).
		
		Effect turns the selected Effect Unit on/off, indicated by light. If you switch into an Effect Unit that is already 
		turned on for this deck, the light will come on.

	Knobs function as follows:

		KNOB				UNSHIFTED				SHIFTED
		Select				Effect parameter1		pre-fader gain
		Control (middle)	Effect parameter2		Effect parameter4
		Control (right)		Effect parameter3		Wet/Dry Mix
*/


NumarkMixTrack.FXbank = [1, 1];	
NumarkMixTrack.FXshifted = [false, false]

NumarkMixTrack.selectFXbank = function(channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	
	var BankSelected = 0;
		
	if (value) {
		NumarkMixTrack.FXshifted[deck-1] = true; //turn on shift while button is held down
		
		//turn off all lights
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["Bank1"], false);
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["Bank2"], false);
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["Bank3"], false);
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["Bank4"], false);

		//set BankSelected
		if (control == 0x59 || control == 0x5d) { //bank 1
			BankSelected = 1;
		}
		if (control == 0x5a || control == 0x5e) { //bank 2
			BankSelected = 2;
		}
		if (control == 0x5b || control == 0x5f) { //bank 3
			BankSelected = 3;
		}
		if (control == 0x5c || control == 0x60) { //bank 4
			BankSelected = 4;
		}		
		
		//set FX bank for current deck and turn on light
		NumarkMixTrack.FXbank[deck-1] = BankSelected;
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["Bank"+NumarkMixTrack.FXbank[deck-1]], true);
		
		//check if this effect is turned on for this channel and adjust FX light accordingly
		var FXenable = engine.getValue("[EffectRack1_EffectUnit"+BankSelected+"]", "group_[Channel"+deck+"]_enable");
		if (FXenable) { //if FX on for this bank, turn on FX light
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["FX"], true);						
		} else { //turn off FX light
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["FX"], false);						
		} 		
	} else {
		NumarkMixTrack.FXshifted[deck-1] = false; //button released, turn off shift
	}
}



 NumarkMixTrack.FXOnOff = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var FXactive = NumarkMixTrack.FXbank[deck-1];
	
	var FXenable = engine.getValue("[EffectRack1_EffectUnit"+FXactive+"]", "group_[Channel"+deck+"]_enable");
	
	if (value) { //only act on button-down
		if (FXenable) { //if effect is on, turn it off and turn off the light
			engine.setValue("[EffectRack1_EffectUnit"+FXactive+"]", "group_[Channel"+deck+"]_enable", false);
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["FX"], false);
		} else { //turn effect and light on
			engine.setValue("[EffectRack1_EffectUnit"+FXactive+"]", "group_[Channel"+deck+"]_enable", true);
			NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["FX"], true);		
		}
	}
} 

 NumarkMixTrack.EffectKnob = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var FXactive = NumarkMixTrack.FXbank[deck-1]; //which bank is selected?
	var param = 0; 
	
	//figure out which parameter we are using
	if (NumarkMixTrack.FXshifted[deck-1]) {
		if (control == 0x1b || control == 0x1e) { //knob 1 shifted
			param = 6;
		}
		if (control == 0x1c || control == 0x1f) { //knob 2 shifted
			param = 4;
		}
		if (control == 0x1d || control == 0x20) { //knob 3 shifted
			param = 5;
		}
	} else {
		if (control == 0x1b || control == 0x1e) { //knob 1 unshifted
			param = 1;
		}
		if (control == 0x1c || control == 0x1f) { //knob 2 unshifted
			param = 2;
		}
		if (control == 0x1d || control == 0x20) { //knob 3 unshifted
			param = 3;
		}
	}

	//get current value

	if (param == 0) {
		print("Error: variable 'param' not set!");
		return;
	}

	if (param == 6) { //this knob controls gain
		var paramVal = engine.getParameter(group, "pregain");
		if (value > 0x40) { //value is increasing
			paramVal = paramVal+0.04; //these knobs turn more slowly for whatever reason; playing around it seemed like this made them behave more like the others
		} else { //going down
			paramVal = paramVal-0.04;
		}
		//set the value
		engine.setParameter(group, "pregain", paramVal);
	}

	//set new value
	if (param == 5) { //special case - this knob controls wet/dry mix
		var paramVal = engine.getParameter("[EffectRack1_EffectUnit"+FXactive+"]", "mix");
		if (value < 0x40) { //value is increasing
			paramVal = paramVal+0.01;
		} else { //going down
			paramVal = paramVal-0.01;
		}
		//set the value
		engine.setParameter("[EffectRack1_EffectUnit"+FXactive+"]", "mix", paramVal);
	} else { //knob controls one of 4 parameters in the effect
		var paramVal = engine.getParameter("[EffectRack1_EffectUnit"+FXactive+"_Effect1]", "parameter"+param);
		if (param == 1) { //these knobs work backward for some reason
			if (value > 0x40) { //value is increasing
				paramVal = paramVal+0.04; //these knobs turn more slowly for whatever reason; playing around it seemed like this made them behave more like the others
			} else { //going down
				paramVal = paramVal-0.04;
			}
		}
		if (param > 1 && param < 5) { //other knobs work normally
			if (value < 0x40) { //value is increasing
				paramVal = paramVal+0.01;
			} else { //going down
				paramVal = paramVal-0.01;
			}
		}
		//set the value
		engine.setParameter("[EffectRack1_EffectUnit"+FXactive+"_Effect1]", "parameter"+param, paramVal);
	}
} 


/*
	BLINKING LIGHTS
	The code below causes buttons to blink when a track is loaded. Blinking stops if track is ejected.
	
	VERSION 1 -- ACTIVE BELOW -- COMMENT OUT TO DISABLE IF USING ANOTHER VERSION (SEE BELOW)
		All buttons blink double every 2 seconds when track is loaded and stopped; all buttons blink on beat when track is playing. 

	VERSION 2 -- REMOVE COMMENTS TO ACTIVATE
		Play button blinks on the beat.
	 	Sync, Cue, and Stutter buttons blink once per second.

	VERSION 3 -- REMOVE COMMENTS TO ACTIVATE
		Play button blinks on the beat.
	 	Sync, Cue, and Stutter buttons blink sequentially in left-to-right sequence. Length of sequence is controlled by CycleTime variable in BlinkOnLoad() function.

*/

//VERSION 1

NumarkMixTrack.beatTimer = [0, 0];
NumarkMixTrack.loadTimer = [0, 0];

NumarkMixTrack.playButton = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var isPlaying = engine.getValue(group, "play");
	
	if (value) { //call only on button-down
		print("play button down")
		if (isPlaying) { //if the track is playing
			engine.stopTimer(NumarkMixTrack.beatTimer[deck-1]) //stop flashing on beat
			engine.setValue(group, "play", false) //stop playing
			NumarkMixTrack.loadLightsOn(deck); //when a track is loaded, turn on the lights 
			NumarkMixTrack.loadFlash(deck); //flash once
			NumarkMixTrack.loadTimer[deck-1] = engine.beginTimer(2000,"NumarkMixTrack.loadFlash("+deck+")"); //start double-flashing 
		} else { //if the track is stopped
			engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]); //stop double-flashing
			engine.setValue(group, "play", true); //start playing
			NumarkMixTrack.beatTimer[deck-1] = engine.beginTimer(25, "NumarkMixTrack.BlinkOnBeat("+deck+")"); //start blinking on beat
		}
	} else {
		print("play button up, no action taken")
	}
}

NumarkMixTrack.cueButton = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var isPlaying = engine.getValue(group, "play");
	
	if (value) { //call only on button-down
		print("cue button down")
		if (isPlaying) { //if the track is playing
			print("cue button -- stop & go back")
			engine.stopTimer(NumarkMixTrack.beatTimer[deck-1]) //stop flashing on beat
			engine.setValue(group, "cue_default", true) //stop and go to cue point
			NumarkMixTrack.loadLightsOn(deck); //when a track is loaded, turn on the lights 
			NumarkMixTrack.loadFlash(deck); //flash once
			NumarkMixTrack.loadTimer[deck-1] = engine.beginTimer(2000,"NumarkMixTrack.loadFlash("+deck+")"); //start double-flashing 
		} else { //if the track is stopped
			print("cue button -- set or play from cue point")
			engine.setValue(group, "cue_default", true); //set cue point or start playing from cue point
		}
	} else {
		print("cue button up, stop playing if playing")
		engine.setValue(group, "cue_default", false); //stop playing from cue point
	}
}

NumarkMixTrack.BlinkOnBeat = function (deck) { //blinks play button off on each beat
	var isBeat = engine.getValue("[Channel"+deck+"]", "beat_active");
	if (isBeat) {
		NumarkMixTrack.loadLightsOff(deck);
	} else {
		NumarkMixTrack.loadLightsOn(deck);
	}
}

NumarkMixTrack.loadTimer = [0, 0];

NumarkMixTrack.BlinkOnLoad = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	print("BlinkOnLoad() called, value="+value+" group="+group+" control="+control);
	if (NumarkMixTrack.loadTimer[deck-1]) {engine.stopTimer(NumarkMixTrack.loadTimer[deck-1])}; //if track is loaded without ejecting first, stop old timer
	if (value) {
		NumarkMixTrack.loadLightsOn(deck); //when a track is loaded, turn on the lights 
		NumarkMixTrack.loadFlash(deck); //flash once
		NumarkMixTrack.loadTimer[deck-1] = engine.beginTimer(2000,"NumarkMixTrack.loadFlash("+deck+")"); //start double-flashing
	} else {
		print("Value Zero, no action");
	}
}

NumarkMixTrack.loadLightsOn = function (deck) { 
	//print("lights on!");
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], true);	
}

NumarkMixTrack.loadLightsOff = function (deck) {
	//print("lights off!")
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], false);		
}

NumarkMixTrack.loadFlash = function (deck) {
	
	
	if (engine.getValue("[Channel"+deck+"]","track_samples")) { //if track is loaded
		NumarkMixTrack.loadLightsOff(deck); //blink lights off
		engine.beginTimer(100,"NumarkMixTrack.loadLightsOn("+deck+")",true); //turn them back on
		engine.beginTimer(200,"NumarkMixTrack.loadLightsOff("+deck+")",true); //turn them off again
		engine.beginTimer(300,"NumarkMixTrack.loadLightsOn("+deck+")",true); //turn them back on
	}
}

NumarkMixTrack.unloadLightsOff = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	
	NumarkMixTrack.loadLightsOff(deck); //turn lights off
	print("Stopping load-flash timer, id="+NumarkMixTrack.loadTimer[deck-1]);	
	engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]); //stop the timer because track has been ejected
}

//END VERSION 1

/*

//VERSION 2

NumarkMixTrack.beatTimer = [0, 0];
NumarkMixTrack.loadTimer = [0, 0];

NumarkMixTrack.playButton = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var isPlaying = engine.getValue(group, "play");
	
	if (value) { //call only on button-down
		print("play button down")
		if (isPlaying) { //if the track is playing
			engine.setValue(group, "play", false) //stop playing
			engine.stopTimer(NumarkMixTrack.beatTimer[deck-1])
		} else { //if the track is stopped
			engine.setValue(group, "play", true) //start playing
			NumarkMixTrack.beatTimer[deck-1] = engine.beginTimer(25, "NumarkMixTrack.BlinkOnBeat("+deck+")"); //start blinking
		}
	} else {
		print("play button up, no action taken")
	}
}
NumarkMixTrack.BlinkOnBeat = function (deck) { //blinks play button off on each beat
	var isBeat = engine.getValue("[Channel"+deck+"]", "beat_active");
	if (isBeat) {
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], false);
	} else {
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], true);
	}
}

NumarkMixTrack.BlinkOnLoad = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	print("BlinkOnLoad() called, value="+value+" group="+group+" control="+control);
	if (value) {
		NumarkMixTrack.loadLightsOn(deck); //when a track is loaded, turn on the lights aside from "play"
		NumarkMixTrack.loadTimer[deck-1] = engine.beginTimer(1000,"NumarkMixTrack.loadFlash("+deck+")"); //start flashing
	} else {
		print("Value Zero, no action");
	}
}

NumarkMixTrack.loadLightsOn = function (deck) { 
	//print("lights on!");
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], true);	
}

NumarkMixTrack.loadLightsOff = function (deck) {
	//print("lights off!")
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], false);		
}

NumarkMixTrack.loadFlash = function (deck) {
	
	
	if (engine.getValue("[Channel"+deck+"]","track_samples")) { //if track is loaded
		NumarkMixTrack.loadLightsOff(deck); //blink lights off
		engine.beginTimer(100,"NumarkMixTrack.loadLightsOn("+deck+")",true); //turn them back on
}

NumarkMixTrack.unloadLightsOff = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	
	NumarkMixTrack.loadLightsOff(deck); //turn lights off
	print("Stopping load-flash timer, id="+NumarkMixTrack.loadTimer[deck-1]);	
	engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]); //stop the timer because track has been ejected
}

//END VERSION 2
*/

/* 

//VERSION 3

NumarkMixTrack.beatTimer = [0, 0];

NumarkMixTrack.playButton = function (channel, control, value, status, group) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var isPlaying = engine.getValue(group, "play");
	
	if (value) { //call only on button-down
		print("play button down")
		if (isPlaying) { //if the track is playing
			engine.setValue(group, "play", false) //stop playing
			engine.stopTimer(NumarkMixTrack.beatTimer[deck-1])
		} else { //if the track is stopped
			engine.setValue(group, "play", true) //start playing
			NumarkMixTrack.beatTimer[deck-1] = engine.beginTimer(25, "NumarkMixTrack.BlinkOnBeat("+deck+")"); //start blinking
		}
	} else {
		print("play button up, no action taken")
	}
}


NumarkMixTrack.BlinkOnBeat = function (deck) { //blinks play button off on each beat
	var isBeat = engine.getValue("[Channel"+deck+"]", "beat_active");
	if (isBeat) {
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], false);
	} else {
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["play"], true);
	}
}


NumarkMixTrack.loadTimer = [
	// Deck 1
	{ "sync": 0, "cue": 0, "stutter": 0 },
	{ "sync": 0, "cue": 0, "stutter": 0 }
	];

NumarkMixTrack.BlinkOnLoad = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	var CycleTime = 1000;

	if (value) {
		if (NumarkMixTrack.loadTimer[deck-1]["sync"]) {engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["sync"])}; //if track is loaded without ejecting first, stop old timer
		if (NumarkMixTrack.loadTimer[deck-1]["cue"]) {engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["cue"])}; //if track is loaded without ejecting first, stop old timer
		if (NumarkMixTrack.loadTimer[deck-1]["stutter"]) {engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["stutter"])}; //if track is loaded without ejecting first, stop old timer
		NumarkMixTrack.loadLightsOn(deck); //when a track is loaded, turn on the lights aside from "play"
		NumarkMixTrack.loadTimer[deck-1]["sync"] = engine.beginTimer(CycleTime,"NumarkMixTrack.loadFlashSync("+deck+")");
		engine.beginTimer((CycleTime / 3),"NumarkMixTrack.loadTimer["+(deck-1)+"][\"cue\"] = engine.beginTimer("+CycleTime+",\"NumarkMixTrack.loadFlashCue("+deck+")\")", true);
		engine.beginTimer(((CycleTime / 3) * 2),"NumarkMixTrack.loadTimer["+(deck-1)+"][\"stutter\"] = engine.beginTimer("+CycleTime+",\"NumarkMixTrack.loadFlashStutter("+deck+")\")", true);
	} else {
		print("Value Zero, no action");
	}
}

NumarkMixTrack.loadLightsOn = function (deck) { 
	//print("lights on!");
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], true);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], true);	
}

NumarkMixTrack.loadLightsOff = function (deck) {
	//print("lights off!")
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], false);	
	NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], false);		
}

NumarkMixTrack.loadFlashSync = function (deck) {
	if (engine.getValue("[Channel"+deck+"]","track_samples")) { //if track is loaded
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["sync"], false);	//blink lights off
		engine.beginTimer(100,"NumarkMixTrack.setLED(NumarkMixTrack.leds["+deck+"][\"sync\"], true);",true); //turn them back on
	} 
}

NumarkMixTrack.loadFlashCue = function (deck) {
	if (engine.getValue("[Channel"+deck+"]","track_samples")) { //if track is loaded
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["cue"], false);	//blink lights off
		engine.beginTimer(100,"NumarkMixTrack.setLED(NumarkMixTrack.leds["+deck+"][\"cue\"], true);",true); //turn them back on
	} 
}

NumarkMixTrack.loadFlashStutter = function (deck) {
	if (engine.getValue("[Channel"+deck+"]","track_samples")) { //if track is loaded
		NumarkMixTrack.setLED(NumarkMixTrack.leds[deck]["stutter"], false);	//blink lights off
		engine.beginTimer(100,"NumarkMixTrack.setLED(NumarkMixTrack.leds["+deck+"][\"stutter\"], true);",true); //turn them back on
	} 
}

NumarkMixTrack.unloadLightsOff = function (value, group, control) {
	var deck = NumarkMixTrack.groupToDeck(group);
	
	NumarkMixTrack.loadLightsOff(deck); //turn lights off
	engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["sync"]); //stop the timer because track has been ejected
	engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["cue"]); //stop the timer because track has been ejected
	engine.stopTimer(NumarkMixTrack.loadTimer[deck-1]["stutter"]); //stop the timer because track has been ejected
}

// END VERSION 3
*/


