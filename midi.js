VF = Vex.Flow;

var currentNotes = new Array();
var notesToPress = new Array();

function handleMidi() {
    navigator.requestMIDIAccess()
        .then(onMIDISuccess, onMIDIFailure);

    function onMIDIFailure() {
        console.log('Could not access your MIDI devices.');
    }
    function onMIDISuccess(midiAccess) {
        for (var input of midiAccess.inputs.values()) {
            input.onmidimessage = getMIDIMessage;
        }
    }

    function getMIDIMessage(message) {
        var command = message.data[0];
        var note = message.data[1];
        var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

        switch (command) {
            case 144: // noteOn
                if (velocity > 0) {
                    noteOn(note);
                } else {
                    noteOff(note);
                }
                break;
            case 128: // noteOff
                noteOff(note);
                break;
            // we could easily expand this switch statement to cover other types of commands such as controllers or sysex
        }
    }


    function noteOn(note) {
        currentNotes.push(note);
        printNotes(currentNotes);
        drawStave();
    }

    function noteOff(note) {
        if (guessIsCorrect()) {
            chooseNewNotes();
        }
        currentNotes = currentNotes.filter(x => x != note);
        printNotes(currentNotes);
        drawStave();
    }
}

function fullNoteNames(midiNumbers) {
    var trebleNoteNames = Array()
    var bassNoteNames = Array()

    midiNumbers.forEach(number => {
        var names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        var normalizedNumber = (number - 36 + names.length);
        var octave = Math.floor(normalizedNumber / names.length);
        var noteName = names[normalizedNumber % names.length]
        var fullNoteName = noteName + "/" + octave;
        if (octave < 4) {
            bassNoteNames.push(fullNoteName);
        } else {
            trebleNoteNames.push(fullNoteName);
        }
    });

    return [trebleNoteNames, bassNoteNames];
}

function notesFromMidiNumbers(midiNumbers) {
    var [trebleNoteNames, bassNoteNames] = fullNoteNames(midiNumbers);

    var trebleChord;
    if (trebleNoteNames.length != 0) {
        trebleChord = new VF.StaveNote({ clef: "treble", keys: trebleNoteNames, duration: "2" });

        trebleNoteNames.forEach((noteName, idx) => {
            if (noteName.includes("#")) {
                trebleChord.addAccidental(idx, new VF.Accidental("#"))
            } else if (noteName.includes("b")) {
                trebleChord.addAccidental(idx, new VF.Accidental("b"))
            }
        });
    } else {
        trebleChord = new VF.StaveNote({ clef: "treble", keys: ["d/5"], duration: "2r" });
    }
    var bassChord;
    if (bassNoteNames.length != 0) {
        bassChord = new VF.StaveNote({ clef: "bass", keys: bassNoteNames, duration: "2" });
        bassNoteNames.forEach((noteName, idx) => {
            if (noteName.includes("#")) {
                bassChord.addAccidental(idx, new VF.Accidental("#"))
            } else if (noteName.includes("b")) {
                bassChord.addAccidental(idx, new VF.Accidental("b"))
            }
        });
    } else {
        bassChord = new VF.StaveNote({ clef: "bass", keys: ["f/3"], duration: "2r" });
    }

    return [trebleChord, bassChord];
}

function printNotes(midiNumbers) {
    var div = document.getElementById("pressed");
    var names = fullNoteNames(midiNumbers);
    div.innerHTML = names;
}

function guessIsCorrect() {
    return arraysEqual(currentNotes, notesToPress);
}

// wtf js? There's no Set equality method?
function arraysEqual(_arr1, _arr2) {
    if (!Array.isArray(_arr1) || !Array.isArray(_arr2) || _arr1.length !== _arr2.length)
        return false;

    var arr1 = _arr1.concat().sort();
    var arr2 = _arr2.concat().sort();

    for (var i = 0; i < arr1.length; i++) {

        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;

}

function chooseNewNotes() {
    var minimum = 52;
    var maximum = 93;
    notesToPress = [Math.floor(Math.random() * (maximum - minimum + 1)) + minimum];
}

function voiceFromChord(chords, stave, formatter, context) {
    var voice = new Vex.Flow.Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables(chords);
    voice.setStrict(false);
    voice.setStave(stave);
    formatter.joinVoices([voice]);
    return voice
}

function drawStave() {
    // Create an SVG renderer and attach it to the DIV element named "boo".
    var div = document.getElementById("boo")
    div.innerHTML = "";

    var renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
    var formatter = new Vex.Flow.Formatter();

    // Configure the rendering context.
    renderer.resize(500, 500);
    var context = renderer.getContext();
    context.setFont("Arial", 10, "").setBackgroundFillStyle("#eed");

    var trebleStave = new VF.Stave(25, 10, 400);
    trebleStave.addClef("treble").addTimeSignature("4/4");
    var bassStave = new VF.Stave(25, 120, 400);
    bassStave.addClef("bass").addTimeSignature("4/4");

    trebleStave.setContext(context);
    bassStave.setContext(context);

    var connector = new VF.StaveConnector(trebleStave, bassStave);
    connector.setType(VF.StaveConnector.type.SINGLE);
    connector.setContext(context);
    trebleStave.draw();
    bassStave.draw();
    connector.draw();

    var [trebleChord, bassChord] = notesFromMidiNumbers(currentNotes);
    var [trebleToPress, bassToPress] = notesFromMidiNumbers(notesToPress);

    var trebleVoice = voiceFromChord([trebleChord, trebleToPress], trebleStave, formatter, context)
    var bassVoice = voiceFromChord([bassChord, bassToPress], bassStave, formatter, context);

    formatter.format([trebleVoice, bassVoice], 400);
    trebleVoice.draw(context, trebleStave);
    bassVoice.draw(context, bassStave);
}

window.onload = init;

function init() {
    chooseNewNotes();
    handleMidi();
    drawStave();
}
