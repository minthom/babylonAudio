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

class Playground {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        // Create a basic Babylon Scene object (non-mesh)
        const scene = new BABYLON.Scene(engine);

        // Create and position an arc-rotate camera
        const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        // Get the Babylon.js audio engine, audio context, and master gain node
        const audioEngine = BABYLON.Engine.audioEngine!;
        const audioContext = audioEngine.audioContext!;
        const masterGainNode = audioEngine.masterGain;

        // Add test tones. Left speaker gets a 440 Hz sine wave, right speaker gets a 660 Hz sine wave
        const leftSound = new OscillatorNode(audioContext, { frequency: 440 });
        const rightSound = new OscillatorNode(audioContext, { frequency: 660 });

        // Add panner nodes to position the sound sources to the left and right
        const leftPanner = new StereoPannerNode(audioContext, { pan: -1 });
        const rightPanner = new StereoPannerNode(audioContext, { pan: 1 });

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
            if (audioContext.state === "suspended") {
                audioContext.resume().then(() => console.log("Audio context resumed"));
            } else if (audioContext.state === "running") {
                audioContext.suspend().then(() => console.log("Audio context suspended"));
            }
        });

        // Add analyzer node and connect it to the end of the audio graph
        const analyzer = new AnalyserNode(audioContext);
        masterGainNode.connect(analyzer);

        const freqData = new Float32Array(analyzer.frequencyBinCount);

        // Create a separate canvas for the audio visualization
        const visualizationCanvas = document.createElement("canvas");
        visualizationCanvas.width = canvas.width;
        visualizationCanvas.height = canvas.height;
        visualizationCanvas.style.position = "absolute";
        visualizationCanvas.style.top = canvas.offsetTop + "px";
        visualizationCanvas.style.left = canvas.offsetLeft + "px";
        document.body.appendChild(visualizationCanvas);

        const ctx = visualizationCanvas.getContext("2d");
        if (!ctx) {
            console.error("2D context not available.");
            return scene;
        }

        // Call the new visualization method in the render loop with parameters for flexibility
        scene.onAfterRenderObservable.add(() => {
            Playground.visualizeFreqData(ctx, analyzer, freqData, {
                min: -60, // Minimum dB threshold for visualization
                range: { minFreq: 50, maxFreq: 2000 }, // Frequency range to visualize
                barColor: "rgb(100, 50, 150)", // Color for bars
                backgroundColor: "#000", // Background color
            });
        });

        return scene;
    }

    // Updated method to visualize frequency data with parameters for customization
    public static visualizeFreqData(
        ctx: CanvasRenderingContext2D,
        analyzer: AnalyserNode,
        freqData: Float32Array,
        options: {
            min: number;
            range: { minFreq: number; maxFreq: number };
            barColor: string;
            backgroundColor: string;
        }
    ): void {
        const { min, range, barColor, backgroundColor } = options;

        // Get updated frequency data
        analyzer.getFloatFrequencyData(freqData);

        // Clear the canvas before drawing
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Calculate the frequency bin range based on the sample rate and FFT size
        const nyquistFreq = analyzer.context.sampleRate / 2;
        const barWidth = ctx.canvas.width / freqData.length;

        for (let i = 0; i < freqData.length; i++) {
            const frequencyIndex = (i / freqData.length) * nyquistFreq;

            // Only show frequencies within the specified range
            if (frequencyIndex < range.minFreq || frequencyIndex > range.maxFreq) {
                continue;
            }

            // Apply the minimum threshold to frequency data
            const value = freqData[i] < min ? 0 : freqData[i];

            const barHeight = (value + 140) * 2; // Adjust to make the bars visible
            ctx.fillStyle = barColor;
            ctx.fillRect(i * barWidth, ctx.canvas.height - barHeight, barWidth, barHeight);
        }
    }
}

// Declaration for dat variable
declare var dat: any;

// Export the Playground class
export { Playground };
