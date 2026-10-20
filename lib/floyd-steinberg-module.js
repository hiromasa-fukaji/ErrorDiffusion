/**
 * Floyd-Steinberg Dithering Module for p5.js
 *
 * This module provides a comprehensive implementation of the Floyd-Steinberg
 * error diffusion dithering algorithm, optimized for use with p5.js projects.
 *
 * The Floyd-Steinberg algorithm works by:
 * 1. Converting each pixel to binary (0 or 255) based on a threshold
 * 2. Calculating the quantization error (difference between original and binary value)
 * 3. Distributing this error to neighboring pixels using weighted diffusion
 *
 * Error diffusion pattern (standard Floyd-Steinberg):
 *     current → right (7/16)
 *        ↓       ↓
 *   left-down  down  right-down
 *    (3/16)   (5/16)   (1/16)
 *
 * @author Based on Signal v3 by synthymental.com
 * @version 1.0.0
 */

import { DITHERING_PRESETS } from './dithering-presets.js';

/**
 * Main Floyd-Steinberg dithering processor class
 * Provides both synchronous and asynchronous (Web Worker) processing options
 */
export class FloydSteinbergProcessor {

    /**
     * Constructor for the Floyd-Steinberg processor
     * @param {Object} options - Configuration options
     * @param {boolean} options.useWebWorker - Whether to use Web Worker for processing (default: true)
     * @param {string} options.workerPath - Path to the worker file (default: './dithering-worker.js')
     * @param {boolean} options.debug - Enable debug logging (default: false)
     */
    constructor(options = {}) {
        this.useWebWorker = options.useWebWorker !== false; // Default to true
        this.workerPath = options.workerPath || './dithering-worker.js';
        this.debug = options.debug || false;

        // Web Worker state management
        this.worker = null;
        this.workerBusy = false;
        this.processingCallbacks = new Map(); // Store callbacks for async operations
        this.callbackId = 0; // Unique ID for each processing request

        // Initialize Web Worker if requested
        if (this.useWebWorker) {
            this._initializeWorker();
        }

        this._log('FloydSteinbergProcessor initialized', {
            useWebWorker: this.useWebWorker,
            workerPath: this.workerPath
        });
    }

    /**
     * Process an image using Floyd-Steinberg dithering (Async version using Web Worker)
     * @param {p5.Image} sourceImage - The p5.js Image object to process
     * @param {Object|string} options - Processing options or preset name
     * @param {string} options.preset - Preset name (e.g., 'floyd-steinberg', 'anatoly')
     * @param {number} options.threshold - Threshold value for binarization (0-255)
     * @param {Array<number>} options.weights - Custom error diffusion weights [right, left-down, down, right-down]
     * @param {number} options.colorMode - Color processing mode (0-4)
     * @returns {Promise<p5.Image>} Promise that resolves to the processed image
     */
    async processImage(sourceImage, options = {}) {
        if (!this.useWebWorker) {
            return this.processImageSync(sourceImage, options);
        }

        return new Promise((resolve, reject) => {
            try {
                const processedOptions = this._normalizeOptions(options);
                const callbackId = ++this.callbackId;

                // Store callback for this processing request
                this.processingCallbacks.set(callbackId, { resolve, reject });

                // Prepare image data for worker
                sourceImage.loadPixels();
                const imageData = {
                    pixels: sourceImage.pixels.buffer.slice(), // Create a copy
                    width: sourceImage.width,
                    height: sourceImage.height,
                    ...processedOptions,
                    callbackId
                };

                this._log('Sending image to worker', {
                    width: sourceImage.width,
                    height: sourceImage.height,
                    callbackId
                });

                // Send to worker with transferable objects for better performance
                this.worker.postMessage(imageData, [imageData.pixels]);

            } catch (error) {
                this._log('Error in processImage', error);
                reject(error);
            }
        });
    }

    /**
     * Process an image using Floyd-Steinberg dithering (Synchronous version)
     * This method runs on the main thread and may block UI for large images
     * @param {p5.Image} sourceImage - The p5.js Image object to process
     * @param {Object|string} options - Processing options or preset name
     * @returns {p5.Image} The processed image
     */
    processImageSync(sourceImage, options = {}) {
        const processedOptions = this._normalizeOptions(options);

        this._log('Processing image synchronously', {
            width: sourceImage.width,
            height: sourceImage.height,
            options: processedOptions
        });

        // Load source pixels
        sourceImage.loadPixels();

        // Create result image
        const resultImage = createImage(sourceImage.width, sourceImage.height);
        resultImage.loadPixels();

        // Apply Floyd-Steinberg algorithm
        const processedPixels = this._applyFloydSteinbergAlgorithm(
            sourceImage.pixels,
            sourceImage.width,
            sourceImage.height,
            processedOptions
        );

        // Set processed pixels to result image
        resultImage.pixels.set(processedPixels);
        resultImage.updatePixels();

        return resultImage;
    }

    /**
     * Get all available presets
     * @returns {Object} Object containing all available presets
     */
    getPresets() {
        return { ...DITHERING_PRESETS };
    }

    /**
     * Get a specific preset configuration
     * @param {string} presetName - Name of the preset
     * @returns {Object|null} Preset configuration or null if not found
     */
    getPreset(presetName) {
        return DITHERING_PRESETS[presetName] || null;
    }

    /**
     * Add or update a custom preset
     * @param {string} name - Name of the custom preset
     * @param {Object} config - Preset configuration
     * @param {Array<number>} config.weights - Error diffusion weights [right, left-down, down, right-down]
     * @param {number} config.threshold - Threshold value (0-255)
     * @param {number} config.colorMode - Color processing mode (0-4)
     * @param {string} config.description - Description of the preset
     */
    addCustomPreset(name, config) {
        if (!this._validatePresetConfig(config)) {
            throw new Error('Invalid preset configuration');
        }

        DITHERING_PRESETS[name] = {
            name: config.name || name,
            weights: [...config.weights], // Create a copy
            threshold: config.threshold,
            colorMode: config.colorMode || 0,
            description: config.description || 'Custom preset'
        };

        this._log('Custom preset added', { name, config });
    }

    /**
     * Dispose of the processor and clean up resources
     */
    dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.processingCallbacks.clear();
        this._log('FloydSteinbergProcessor disposed');
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Initialize the Web Worker for background processing
     * @private
     */
    _initializeWorker() {
        try {
            this.worker = new Worker(this.workerPath);

            // Handle messages from worker
            this.worker.onmessage = (event) => {
                this._handleWorkerMessage(event);
            };

            // Handle worker errors
            this.worker.onerror = (error) => {
                this._log('Worker error', error);
                // Reject all pending callbacks
                this.processingCallbacks.forEach(({ reject }) => {
                    reject(new Error('Worker error: ' + error.message));
                });
                this.processingCallbacks.clear();
            };

            this._log('Web Worker initialized successfully');

        } catch (error) {
            this._log('Failed to initialize Web Worker', error);
            this.useWebWorker = false; // Fall back to synchronous processing
        }
    }

    /**
     * Handle messages received from the Web Worker
     * @private
     * @param {MessageEvent} event - Message event from worker
     */
    _handleWorkerMessage(event) {
        const { processedPixels, width, height, callbackId, error } = event.data;

        // Find the corresponding callback
        const callback = this.processingCallbacks.get(callbackId);
        if (!callback) {
            this._log('Received message for unknown callback ID', callbackId);
            return;
        }

        // Remove callback from map
        this.processingCallbacks.delete(callbackId);

        if (error) {
            this._log('Worker processing error', error);
            callback.reject(new Error(error));
            return;
        }

        try {
            // Create result image from processed pixels
            const resultImage = createImage(width, height);
            resultImage.loadPixels();
            resultImage.pixels.set(new Uint8ClampedArray(processedPixels));
            resultImage.updatePixels();

            this._log('Image processing completed', { width, height, callbackId });
            callback.resolve(resultImage);

        } catch (err) {
            this._log('Error creating result image', err);
            callback.reject(err);
        }
    }

    /**
     * Normalize and validate processing options
     * @private
     * @param {Object|string} options - Raw options or preset name
     * @returns {Object} Normalized options
     */
    _normalizeOptions(options) {
        // If options is a string, treat it as a preset name
        if (typeof options === 'string') {
            options = { preset: options };
        }

        // Get preset configuration
        let config = {};
        if (options.preset) {
            const preset = this.getPreset(options.preset);
            if (!preset) {
                throw new Error(`Unknown preset: ${options.preset}`);
            }
            config = { ...preset };
        }

        // Override with custom options
        return {
            threshold: options.threshold !== undefined ? options.threshold : config.threshold || 127,
            weights: options.weights ? [...options.weights] : [...(config.weights || [7/16, 3/16, 5/16, 1/16])],
            colorMode: options.colorMode !== undefined ? options.colorMode : config.colorMode || 0
        };
    }

    /**
     * Validate preset configuration
     * @private
     * @param {Object} config - Preset configuration to validate
     * @returns {boolean} True if valid
     */
    _validatePresetConfig(config) {
        if (!config || typeof config !== 'object') return false;
        if (!Array.isArray(config.weights) || config.weights.length !== 4) return false;
        if (typeof config.threshold !== 'number' || config.threshold < 0 || config.threshold > 255) return false;
        if (config.colorMode !== undefined && (typeof config.colorMode !== 'number' || config.colorMode < 0 || config.colorMode > 4)) return false;
        return true;
    }

    /**
     * Core Floyd-Steinberg dithering algorithm implementation
     * This is the heart of the dithering process, where each pixel is processed
     * and errors are distributed to neighboring pixels
     *
     * @private
     * @param {Uint8ClampedArray} sourcePixels - Source image pixel data (RGBA)
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Object} options - Processing options
     * @returns {Uint8ClampedArray} Processed pixel data
     */
    _applyFloydSteinbergAlgorithm(sourcePixels, width, height, options) {
        const { threshold, weights, colorMode } = options;
        const [weightRight, weightLeftDown, weightDown, weightRightDown] = weights;

        // Create working copy of pixel data for error accumulation
        const workingPixels = new Uint8ClampedArray(sourcePixels);

        // Create result pixel data
        const resultPixels = new Uint8ClampedArray(sourcePixels.length);

        this._log('Starting Floyd-Steinberg algorithm', {
            width, height, threshold, weights, colorMode
        });

        // Process each pixel (excluding last row and column to avoid boundary issues)
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const pixelIndex = (x + y * width) * 4; // RGBA pixel index

                // Get current pixel RGB values (ignore alpha)
                const originalR = workingPixels[pixelIndex];
                const originalG = workingPixels[pixelIndex + 1];
                const originalB = workingPixels[pixelIndex + 2];

                // Apply threshold to create binary values
                const binaryR = originalR > threshold ? 255 : 0;
                const binaryG = originalG > threshold ? 255 : 0;
                const binaryB = originalB > threshold ? 255 : 0;

                // Calculate quantization error for each channel
                const errorR = originalR - binaryR;
                const errorG = originalG - binaryG;
                const errorB = originalB - binaryB;

                // Write binary values to result
                resultPixels[pixelIndex] = binaryR;
                resultPixels[pixelIndex + 1] = binaryG;
                resultPixels[pixelIndex + 2] = binaryB;
                resultPixels[pixelIndex + 3] = 255; // Full opacity

                // Distribute error to neighboring pixels
                this._distributeError(workingPixels, width, height, x, y,
                                    errorR, errorG, errorB, weights, colorMode);
            }
        }

        this._log('Floyd-Steinberg algorithm completed');
        return resultPixels;
    }

    /**
     * Distribute quantization error to neighboring pixels
     * This implements the core error diffusion pattern of Floyd-Steinberg
     *
     * @private
     * @param {Uint8ClampedArray} pixels - Working pixel array
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} x - Current pixel X coordinate
     * @param {number} y - Current pixel Y coordinate
     * @param {number} errorR - Red channel error
     * @param {number} errorG - Green channel error
     * @param {number} errorB - Blue channel error
     * @param {Array<number>} weights - Error diffusion weights
     * @param {number} colorMode - Color processing mode
     */
    _distributeError(pixels, width, height, x, y, errorR, errorG, errorB, weights, colorMode) {
        const [weightRight, weightLeftDown, weightDown, weightRightDown] = weights;

        // Distribute error to right pixel (x+1, y)
        if (x + 1 < width) {
            this._addErrorToPixel(pixels, width, x + 1, y,
                                errorR * weightRight,
                                errorG * weightRight,
                                errorB * weightRight, colorMode);
        }

        // Distribute error to left-down pixel (x-1, y+1)
        if (x - 1 >= 0 && y + 1 < height) {
            this._addErrorToPixel(pixels, width, x - 1, y + 1,
                                errorR * weightLeftDown,
                                errorG * weightLeftDown,
                                errorB * weightLeftDown, colorMode);
        }

        // Distribute error to down pixel (x, y+1)
        if (y + 1 < height) {
            this._addErrorToPixel(pixels, width, x, y + 1,
                                errorR * weightDown,
                                errorG * weightDown,
                                errorB * weightDown, colorMode);
        }

        // Distribute error to right-down pixel (x+1, y+1)
        if (x + 1 < width && y + 1 < height) {
            this._addErrorToPixel(pixels, width, x + 1, y + 1,
                                errorR * weightRightDown,
                                errorG * weightRightDown,
                                errorB * weightRightDown, colorMode);
        }
    }

    /**
     * Add error to a specific pixel with color mode transformation
     *
     * @private
     * @param {Uint8ClampedArray} pixels - Pixel array to modify
     * @param {number} width - Image width
     * @param {number} x - Pixel X coordinate
     * @param {number} y - Pixel Y coordinate
     * @param {number} errorR - Red channel error to add
     * @param {number} errorG - Green channel error to add
     * @param {number} errorB - Blue channel error to add
     * @param {number} colorMode - Color processing mode (0-4)
     */
    _addErrorToPixel(pixels, width, x, y, errorR, errorG, errorB, colorMode) {
        const pixelIndex = (x + y * width) * 4;

        // Get current pixel values
        let currentR = pixels[pixelIndex];
        let currentG = pixels[pixelIndex + 1];
        let currentB = pixels[pixelIndex + 2];

        // Add error to current values
        let newR = this._clamp(currentR + errorR);
        let newG = this._clamp(currentG + errorG);
        let newB = this._clamp(currentB + errorB);

        // Apply color mode transformation
        const [finalR, finalG, finalB] = this._applyColorMode(newR, newG, newB, colorMode);

        // Write back to pixel array
        pixels[pixelIndex] = finalR;
        pixels[pixelIndex + 1] = finalG;
        pixels[pixelIndex + 2] = finalB;
    }

    /**
     * Apply color mode transformation to RGB values
     * Different color modes create various artistic effects by remapping color channels
     *
     * @private
     * @param {number} r - Red channel value
     * @param {number} g - Green channel value
     * @param {number} b - Blue channel value
     * @param {number} colorMode - Color mode (0-4)
     * @returns {Array<number>} Transformed RGB values
     */
    _applyColorMode(r, g, b, colorMode) {
        switch (colorMode) {
            case 1: // Green-Blue emphasis
                return [g, b, b];
            case 2: // Color rotation
                return [g, b, r];
            case 3: // Blue emphasis
                return [b, g, r];
            case 4: // Custom mix
                return [b, r, g];
            case 0: // Standard RGB (default)
            default:
                return [r, g, b];
        }
    }

    /**
     * Clamp a value between 0 and 255 (valid RGB range)
     * @private
     * @param {number} value - Value to clamp
     * @returns {number} Clamped value
     */
    _clamp(value) {
        return Math.min(255, Math.max(0, value));
    }

    /**
     * Debug logging utility
     * @private
     * @param {string} message - Log message
     * @param {any} data - Optional data to log
     */
    _log(message, data = null) {
        if (this.debug) {
            if (data) {
                console.log(`[FloydSteinbergProcessor] ${message}`, data);
            } else {
                console.log(`[FloydSteinbergProcessor] ${message}`);
            }
        }
    }
}

/**
 * Utility function to create a Floyd-Steinberg processor with default settings
 * @param {Object} options - Optional configuration
 * @returns {FloydSteinbergProcessor} New processor instance
 */
export function createDitheringProcessor(options = {}) {
    return new FloydSteinbergProcessor(options);
}

/**
 * Simple utility function for quick dithering without creating a processor instance
 * @param {p5.Image} image - Image to process
 * @param {string|Object} options - Preset name or options object
 * @returns {Promise<p5.Image>} Processed image
 */
export async function ditherImage(image, options = 'floyd-steinberg') {
    const processor = new FloydSteinbergProcessor();
    const result = await processor.processImage(image, options);
    processor.dispose();
    return result;
}