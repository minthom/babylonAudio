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

        const whiteNoiseNode = Playground.audioContext.createScriptProcessor(4096, 1, 1);
        whiteNoiseNode.onaudioprocess = (audioProcessingEvent) => {
            const output = audioProcessingEvent.outputBuffer.getChannelData(0);
            for (let i = 0; i < output.length; i++) {
                output[i] = Math.random() * 2 - 1; // Generate white noise (-1 to 1)
            }
        };

        function playRandomFrequencies() {
            const randomFrequency = Math.random() * 2000 + 200; // Random frequency between 200 Hz and 2200 Hz
            const oscillator = new OscillatorNode(Playground.audioContext, { frequency: randomFrequency });
            oscillator.connect(masterGainNode);
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200); // Play for 200ms
        }

        // Call this function periodically to generate random tones
        setInterval(playRandomFrequencies, 300); // Play a new tone every 300ms

        // Add analyzer node and connect it to the end of the audio graph
        const analyzer = new AnalyserNode(Playground.audioContext);
        masterGainNode.connect(analyzer);

        let freqData = new Float32Array(analyzer.frequencyBinCount);

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
        //ctx.fillStyle = "#000";
        //ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Call the new visualization method in the render loop with parameters for flexibility
        //scene.onAfterRenderObservable.add(() => {
        Playground.visualizeFreqData(ctx, analyzer, freqData, {
            minVolume: -60, // Minimum dB threshold for visualization
            range: { minFreq: 1, maxFreq: 24000 }, // Frequency range to visualize
            barColor: "rgb(100, 50, 150)", // Color for bars
            backgroundColor: "#000", // Background color
            timeout: 5000,
            startTime: 2, // Start time in seconds (adjust as needed)
            endTime: 10, // End time in seconds (adjust as needed)
        });
        //});

        return scene;
    }

    public static visualizeFreqData(
        ctx: CanvasRenderingContext2D,
        analyzer: AnalyserNode,
        freqData: Float32Array,
        options: {
            minVolume: number;
            range: { minFreq: number; maxFreq: number };
            barColor: string;
            backgroundColor: string;
            timeout: number;
            startTime: number;
            endTime: number;
        }
    ): void {
        function decimalToHex(r, g, b) {
            function componentToHex(c) {
                let hex = c.toString(16);
                return hex.length === 1 ? "0" + hex : hex;
            }

            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
        }

        const screenWidth = ctx.canvas.width;
        const screenHeight = ctx.canvas.height;

        // for (let x = 0; x < screenWidth; x++) {
        //     for (let y = 0; y < screenHeight / 2; y++) {
        //         ctx.fillRect(x, y, 1, 1);
        //     }
        // }

        const volumeMax = 255;
        const colorMax = 255;
        const volumeToColorRatio = colorMax / volumeMax;

        let x = 0;
        let timeSlice = 0; // Tracks the current horizontal position for the visualization
        let timeSliceAtStart = 0;
        const renderFreqData = () => {
            if (Playground.audioContext.currentTime < options.startTime) {
                // Do not start rendering until the specified startTime
                return requestAnimationFrame(renderFreqData);
            }

            if (Playground.audioContext.currentTime > options.endTime) {
                // Stop rendering once the endTime is reached
                return;
            }

            requestAnimationFrame(renderFreqData);

            // Calculate the current time slice as a percentage of the total time range
            const progress = (Playground.audioContext.currentTime - options.startTime) / (options.endTime - options.startTime);
            const timeSlice = Math.floor(progress * ctx.canvas.width);

            // Clear only the current vertical slice to avoid overwriting the entire canvas
            ctx.clearRect(timeSlice, 0, 1, screenHeight);

            analyzer.getFloatFrequencyData(freqData);

            // Draw the frequency data as vertical bars
            let freqDataIndex = 0;
            for (let y = 0; y < freqData.length; y++) {
                const volume = freqData[freqDataIndex]; // Negative value
                if (volume < options.minVolume) {
                    freqDataIndex++;
                    continue;
                }

                // Calculate a color based on the volume
                const color = Math.round((-volume / options.minVolume) * 255); // Normalize to 0-255
                const colorString = decimalToHex(color, color, color);

                ctx.fillStyle = colorString;
                ctx.fillRect(timeSlice, Math.round(y), 1, 1);

                freqDataIndex++;
            }
        };

        requestAnimationFrame(renderFreqData);
    }
}
// Declaration for dat variable
declare var dat: any;

// Export the Playground class
export { Playground };
