const SomeMagicNumber = 140;
const minValue = -100; // Minimum dB threshold for frequency data
const maxValue = 0; // Maximum dB threshold for frequency data

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

    // Check if the canvas element is found
    if (!canvas) {
        console.error("Canvas element not found!");
        return; // Exit if canvas is not found
    }

    // Initialize the Babylon.js engine with the canvas
    const engine = new BABYLON.Engine(canvas, true);

    // Call the CreateScene method to set up the scene and start rendering
    const scene = Playground.CreateScene(engine, canvas);

    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(() => {
        scene.render();
    });

    // Watch for browser/canvas resize events
    window.addEventListener("resize", () => {
        engine.resize();
    });
});

let timeSlice = 0;

class Playground {
    private static audioContext: AudioContext;

    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        // Create a basic Babylon Scene object (non-mesh)
        const scene = new BABYLON.Scene(engine);

        // Create and position an arc-rotate camera
        const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        // Get the Babylon.js audio engine, audio context, and master gain node
        const audioEngine = BABYLON.Engine.audioEngine!;
        Playground.audioContext = audioEngine.audioContext!;
        const masterGainNode = audioEngine.masterGain;

        // Add test tones. Left speaker gets a 440 Hz sine wave, right speaker gets a 660 Hz sine wave
        const leftSound = new OscillatorNode(Playground.audioContext, { frequency: 440 });
        const rightSound = new OscillatorNode(Playground.audioContext, { frequency: 660 });

        // Add panner nodes to position the sound sources to the left and right
        const leftPanner = new StereoPannerNode(Playground.audioContext, { pan: -1 });
        const rightPanner = new StereoPannerNode(Playground.audioContext, { pan: 1 });

        // Connect the left and right sound sources to the panner nodes
        leftSound.connect(leftPanner);
        rightSound.connect(rightPanner);

        // Connect the panner nodes to the audio engine's master gain node
        leftPanner.connect(masterGainNode);
        rightPanner.connect(masterGainNode);

        // Reduce the master gain volume
        masterGainNode.gain.value = 0.1;

        // Start the sound sources
        leftSound.start();
        rightSound.start();

        // Toggle the audio engine lock on user interaction
        document.addEventListener("click", () => {
            if (Playground.audioContext.state === "suspended") {
                Playground.audioContext.resume().then(() => console.log("Audio context resumed"));
            } else if (Playground.audioContext.state === "running") {
                Playground.audioContext.suspend().then(() => console.log("Audio context suspended"));
            }
        });

        // Add analyzer node and connect it to the end of the audio graph
        const analyzer = new AnalyserNode(Playground.audioContext);
        masterGainNode.connect(analyzer);

        const freqData = new Float32Array(analyzer.frequencyBinCount);

        // Create a separate canvas for the audio visualization
        const visualizationCanvas = document.createElement("canvas");
        visualizationCanvas.width = canvas.width;
        visualizationCanvas.height = canvas.height;
        visualizationCanvas.style.position = "absolute";
        visualizationCanvas.style.top = canvas.offsetTop + "px";
        visualizationCanvas.style.left = "0px"; // Align to the very left of the screen
        document.body.appendChild(visualizationCanvas);

        const ctx = visualizationCanvas.getContext("2d");
        if (!ctx) {
            console.error("2D context not available.");
            return scene;
        }

        // Clear the canvas before drawing
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Call the new visualization method in the render loop with parameters for flexibility
        //scene.onAfterRenderObservable.add(() => {
        Playground.visualizeFreqData(ctx, analyzer, freqData, {
            min: -60, // Minimum dB threshold for visualization
            range: { minFreq: 1, maxFreq: 24000 }, // Frequency range to visualize
            barColor: "rgb(100, 50, 150)", // Color for bars
            backgroundColor: "#000", // Background color
            timeout: 5000,
            startTime: 5, // Start time in seconds (adjust as needed)
            endTime: 7, // End time in seconds (adjust as needed)
        });
        //});

        return scene;
    }

    public static visualizeFreqData(
        ctx: CanvasRenderingContext2D,
        analyzer: AnalyserNode,
        freqData: Float32Array,
        options: {
            min: number;
            range: { minFreq: number; maxFreq: number };
            barColor: string;
            backgroundColor: string;
            timeout: number;
            startTime: number;
            endTime: number;
        }
    ): void {
        const { min, range, barColor, backgroundColor, timeout, startTime, endTime } = options;
        const nyquistFreq = analyzer.context.sampleRate / 2;

        const renderFreqData = () => {
            requestAnimationFrame(renderFreqData);

            const time = Playground.audioContext.currentTime * 1000;
            if (time < timeout || time < startTime * 1000) {
                return;
            }

            const duration = (endTime - startTime) * 1000;
            const elapsedTime = time - startTime * 1000;
            const proportion = elapsedTime / duration;

            const maxTimeSlice = ctx.canvas.width;
            const timeSlice = Math.min(Math.floor(proportion * maxTimeSlice), maxTimeSlice);

            analyzer.getFloatFrequencyData(freqData);

            const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
            gradient.addColorStop(0, barColor);
            gradient.addColorStop(1, "yellow");

            for (let i = 0; i < freqData.length; i++) {
                const frequencyIndex = (i / freqData.length) * nyquistFreq;

                if (frequencyIndex < range.minFreq || frequencyIndex > range.maxFreq) {
                    continue;
                }

                const value = freqData[i];
                const normalizedValue = (value - minValue) / (maxValue - minValue);
                const barHeight = Math.max(-value * 2, 0);

                const yPosition = ctx.canvas.height - barHeight;

                ctx.fillStyle = gradient;
                ctx.fillRect(timeSlice, yPosition, 1, barHeight);
            }
        };

        requestAnimationFrame(renderFreqData);
    }
}
// Declaration for dat variable
declare var dat: any;

// Export the Playground class
export { Playground };
