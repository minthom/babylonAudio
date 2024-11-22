const SomeMagicNumber = 140;
const minValue = -100; // Minimum dB threshold for frequency data
const maxValue = 0; // Maximum dB threshold for frequency data

// document.addEventListener("DOMContentLoaded", () => {
//     const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

//     // Check if the canvas element is found
//     if (!canvas) {
//         console.error("Canvas element not found!");
//         return; // Exit if canvas is not found
//     }

//     // Initialize the Babylon.js engine with the canvas
//     const engine = new BABYLON.Engine(canvas, true);

//     // Call the CreateScene method to set up the scene and start rendering
//     const scene = Playground.CreateScene(engine, canvas);

//     // Register a render loop to repeatedly render the scene
//     engine.runRenderLoop(() => {
//         scene.render();
//     });

//     // Watch for browser/canvas resize events
//     window.addEventListener("resize", () => {
//         engine.resize();
//     });
// });

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

        // const whiteNoiseNode = Playground.audioContext.createScriptProcessor(4096, 1, 1);
        // whiteNoiseNode.onaudioprocess = (audioProcessingEvent) => {
        //     const output = audioProcessingEvent.outputBuffer.getChannelData(0);
        //     for (let i = 0; i < output.length; i++) {
        //         output[i] = Math.random() * 2 - 1; // Generate white noise (-1 to 1)
        //     }
        // };

        let freqIndex = 0;
        function playRandomFrequencies() {
            const frequencySequence = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
            const oscillator = new OscillatorNode(Playground.audioContext, { frequency: frequencySequence[freqIndex] });
            oscillator.connect(masterGainNode);
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200); // Play for 200ms
            if (freqIndex < frequencySequence.length) {
                freqIndex++;
            } else {
                freqIndex = 0;
            }
        }

        // Call this function periodically to generate random tones
        setInterval(playRandomFrequencies, 300); // Play a new tone every 300ms

        masterGainNode.gain.value = 0.1;

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
            minVolume: -200, // Minimum dB threshold for visualization
            range: { min: 0, max: 0.125 }, // Frequency range to visualize
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
            range: { min: number; max: number };
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
        let timeSliceAtStart = 0; // Tracks the timeSlice when the startTime is met, to draw from the left edge of screen
        let endFlag = true; // Tracks if the endTime has been met so that no more changes occur to the canvas
        const renderFreqData = () => {
            if (timeSlice >= ctx.canvas.width) {
                // Don't go through the rest of the function as the screen has been filled
                return;
            }

            requestAnimationFrame(renderFreqData);
            let yRatio = screenHeight / freqData.length;
            if (yRatio > 1) {
                yRatio = 1;
            }

            analyzer.getFloatFrequencyData(freqData);

            if (endFlag) {
                ctx.clearRect(timeSlice, 0, 1, screenHeight); // Clear the current column before drawing
            }

            let freqDataIndex = 0;
            let freqUpperBound = Math.round(freqData.length * yRatio);

            for (let y = 0; y < freqUpperBound; y += yRatio) {
                // Break if the startTime hasn't been met yet
                if (Playground.audioContext.currentTime < options.startTime) {
                    break;
                } else if (timeSlice > ctx.canvas.width) {
                    break;
                }

                // Break when the endTime is met, set flag to false to make sure it doesn't run again, crop, scale, and display image
                else if (Playground.audioContext.currentTime > options.endTime && endFlag) {
                    let myData = ctx.canvas.toDataURL();
                    const image = new Image();

                    // when the image fully loads, perform a crop and scale the cropped image to fit the screen
                    image.onload = () => {
                        const cropX = 0; // starting X for crop
                        const cropY = Math.round(options.range.min * ctx.canvas.height); // starting Y for crop, assumes that you may want to crop lower in image
                        const cropHeight = Math.round(options.range.max * ctx.canvas.height) - cropY; // height of crop in px
                        const cropWidth = timeSlice - timeSliceAtStart; // width of crop in px

                        // draws cropped image of the visualization and scales it to the canvas height and width
                        ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, ctx.canvas.width, ctx.canvas.height);
                        endFlag = false;
                    };
                    image.src = myData;
                    break;
                }

                // endTime is met don't draw any more rectangles
                else if (endFlag == false) {
                    break;
                }

                // Takes the currentTimeSlice as soon as the startTime is met to make sure the visualization always starts from the left side of the screen
                else if (timeSliceAtStart == 0 && options.startTime != 0) {
                    timeSliceAtStart = timeSlice;
                }

                let volume = freqData[freqDataIndex]; // This will be a negative value

                let color = Math.round(-volume * volumeToColorRatio); // Convert to positive to make sure we get a value between 0 and 255

                if (volume < options.minVolume) {
                    color = 255;
                }
                let colorString = decimalToHex(color, color, color);

                ctx.fillStyle = colorString;
                ctx.fillRect(timeSlice - timeSliceAtStart, Math.round(y), 1, 1);
                freqDataIndex++;
            }
            timeSlice++;
        };
        requestAnimationFrame(renderFreqData);
    }
}
// Declaration for dat variable
declare var dat: any;

// Export the Playground class
export { Playground };
