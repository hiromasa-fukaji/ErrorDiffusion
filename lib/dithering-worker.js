/**
 * Floyd-Steinberg Dithering Web Worker
 *
 * This worker handles the computationally intensive Floyd-Steinberg dithering
 * algorithm in a separate thread to prevent UI blocking. The worker receives
 * image data and processing parameters from the main thread, applies the
 * dithering algorithm, and returns the processed image data.
 *
 * The Floyd-Steinberg algorithm:
 * 1. For each pixel, convert to binary (0 or 255) based on threshold
 * 2. Calculate quantization error (original - binary)
 * 3. Distribute error to 4 neighboring pixels with specific weights:
 *    - Right pixel: weight1 (typically 7/16)
 *    - Left-down pixel: weight2 (typically 3/16)
 *    - Down pixel: weight3 (typically 5/16)
 *    - Right-down pixel: weight4 (typically 1/16)
 *
 * @version 1.0.0
 * @author Refactored from Signal v3 by synthymental.com
 */

/**
 * Process image data using Floyd-Steinberg dithering algorithm
 * This is the main entry point for the worker
 */
self.onmessage = function(event) {
    try {
        const {
            pixels,
            width,
            height,
            threshold,
            weights,
            colorMode,
            callbackId
        } = event.data;

        // Validate input data
        if (!validateInputData(event.data)) {
            sendError('Invalid input data received by worker', callbackId);
            return;
        }

        // Log processing start (for debugging)
        // console.log(`[DitheringWorker] Starting processing: ${width}x${height}, threshold: ${threshold}`);

        // Convert ArrayBuffer to Uint8ClampedArray
        const sourcePixels = new Uint8ClampedArray(pixels);

        // Apply Floyd-Steinberg dithering algorithm
        const processedPixels = applyFloydSteinbergDithering(
            sourcePixels,
            width,
            height,
            threshold,
            weights,
            colorMode
        );

        // Send processed result back to main thread
        self.postMessage({
            processedPixels: processedPixels.buffer,
            width: width,
            height: height,
            callbackId: callbackId
        }, [processedPixels.buffer]); // Transfer ownership for better performance

        // console.log(`[DitheringWorker] Processing completed: ${width}x${height}`);

    } catch (error) {
        console.error('[DitheringWorker] Error during processing:', error);
        sendError(error.message, event.data.callbackId);
    }
};

/**
 * Handle worker errors
 */
self.onerror = function(error) {
    console.error('[DitheringWorker] Worker error:', error);
    sendError('Worker execution error: ' + error.message);
};

/**
 * Validate input data received from main thread
 * @param {Object} data - Data received from main thread
 * @returns {boolean} True if data is valid
 */
function validateInputData(data) {
    if (!data) {
        console.error('[DitheringWorker] No data received');
        return false;
    }

    if (!data.pixels) {
        console.error('[DitheringWorker] No pixel data received');
        return false;
    }

    if (typeof data.width !== 'number' || data.width <= 0) {
        console.error('[DitheringWorker] Invalid width:', data.width);
        return false;
    }

    if (typeof data.height !== 'number' || data.height <= 0) {
        console.error('[DitheringWorker] Invalid height:', data.height);
        return false;
    }

    if (typeof data.threshold !== 'number' || data.threshold < 0 || data.threshold > 255) {
        console.error('[DitheringWorker] Invalid threshold:', data.threshold);
        return false;
    }

    if (!Array.isArray(data.weights) || data.weights.length !== 4) {
        console.error('[DitheringWorker] Invalid weights array:', data.weights);
        return false;
    }

    if (typeof data.colorMode !== 'number' || data.colorMode < 0 || data.colorMode > 4) {
        console.error('[DitheringWorker] Invalid colorMode:', data.colorMode);
        return false;
    }

    return true;
}

/**
 * Send error message back to main thread
 * @param {string} errorMessage - Error message to send
 * @param {number} callbackId - Callback ID for error tracking
 */
function sendError(errorMessage, callbackId = null) {
    self.postMessage({
        error: errorMessage,
        callbackId: callbackId
    });
}

/**
 * Apply Floyd-Steinberg dithering algorithm to image data
 *
 * This is the core implementation of the Floyd-Steinberg error diffusion algorithm.
 * It processes each pixel in raster order (left-to-right, top-to-bottom) and
 * distributes quantization errors to neighboring unprocessed pixels.
 *
 * @param {Uint8ClampedArray} sourcePixels - Source image pixel data (RGBA format)
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} threshold - Threshold value for binarization (0-255)
 * @param {Array<number>} weights - Error diffusion weights [right, left-down, down, right-down]
 * @param {number} colorMode - Color processing mode (0-4)
 * @returns {Uint8ClampedArray} Processed image pixel data
 */
function applyFloydSteinbergDithering(sourcePixels, width, height, threshold, weights, colorMode) {
    // Extract individual weight values for better readability
    const [weightRight, weightLeftDown, weightDown, weightRightDown] = weights;

    // Create working copy of pixel data for error accumulation
    // This copy will be modified as we process pixels and accumulate errors
    const workingPixels = new Uint8ClampedArray(sourcePixels);

    // Create result array for the final dithered image
    const resultPixels = new Uint8ClampedArray(sourcePixels.length);

    // console.log(`[DitheringWorker] Processing ${width}x${height} pixels with weights: [${weights.join(', ')}]`);

    // Process each pixel in raster scan order
    // We stop at height-1 and width-1 to avoid boundary checking in error diffusion
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate pixel index in RGBA array (4 values per pixel)
            const pixelIndex = (x + y * width) * 4;

            // Extract RGB values from working copy (alpha is ignored)
            const originalR = workingPixels[pixelIndex];
            const originalG = workingPixels[pixelIndex + 1];
            const originalB = workingPixels[pixelIndex + 2];

            // Apply threshold to create binary values (0 or 255)
            // This is the quantization step that creates the dithered effect
            const quantizedR = originalR > threshold ? 255 : 0;
            const quantizedG = originalG > threshold ? 255 : 0;
            const quantizedB = originalB > threshold ? 255 : 0;

            // Calculate quantization error for each color channel
            // This error will be distributed to neighboring pixels
            const errorR = originalR - quantizedR;
            const errorG = originalG - quantizedG;
            const errorB = originalB - quantizedB;

            // Store quantized values in result array
            resultPixels[pixelIndex] = quantizedR;
            resultPixels[pixelIndex + 1] = quantizedG;
            resultPixels[pixelIndex + 2] = quantizedB;
            resultPixels[pixelIndex + 3] = 255; // Full alpha

            // Distribute error to neighboring pixels using Floyd-Steinberg pattern
            distributeErrorToNeighbors(
                workingPixels, width, height, x, y,
                errorR, errorG, errorB,
                weightRight, weightLeftDown, weightDown, weightRightDown,
                colorMode
            );
        }
    }

    return resultPixels;
}

/**
 * Distribute quantization error to neighboring pixels
 *
 * This function implements the Floyd-Steinberg error diffusion pattern:
 *   Current → Right (weight1)
 *      ↓       ↓
 * Left-Down  Down  Right-Down
 * (weight2) (weight3) (weight4)
 *
 * @param {Uint8ClampedArray} workingPixels - Working pixel array to modify
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} currentX - Current pixel X coordinate
 * @param {number} currentY - Current pixel Y coordinate
 * @param {number} errorR - Red channel error
 * @param {number} errorG - Green channel error
 * @param {number} errorB - Blue channel error
 * @param {number} weightRight - Weight for right pixel
 * @param {number} weightLeftDown - Weight for left-down pixel
 * @param {number} weightDown - Weight for down pixel
 * @param {number} weightRightDown - Weight for right-down pixel
 * @param {number} colorMode - Color processing mode
 */
function distributeErrorToNeighbors(
    workingPixels, width, height, currentX, currentY,
    errorR, errorG, errorB,
    weightRight, weightLeftDown, weightDown, weightRightDown,
    colorMode
) {
    // Distribute error to right pixel (currentX + 1, currentY)
    if (currentX + 1 < width) {
        addWeightedErrorToPixel(
            workingPixels, width, currentX + 1, currentY,
            errorR * weightRight,
            errorG * weightRight,
            errorB * weightRight,
            colorMode
        );
    }

    // Distribute error to left-down pixel (currentX - 1, currentY + 1)
    if (currentX - 1 >= 0 && currentY + 1 < height) {
        addWeightedErrorToPixel(
            workingPixels, width, currentX - 1, currentY + 1,
            errorR * weightLeftDown,
            errorG * weightLeftDown,
            errorB * weightLeftDown,
            colorMode
        );
    }

    // Distribute error to down pixel (currentX, currentY + 1)
    if (currentY + 1 < height) {
        addWeightedErrorToPixel(
            workingPixels, width, currentX, currentY + 1,
            errorR * weightDown,
            errorG * weightDown,
            errorB * weightDown,
            colorMode
        );
    }

    // Distribute error to right-down pixel (currentX + 1, currentY + 1)
    if (currentX + 1 < width && currentY + 1 < height) {
        addWeightedErrorToPixel(
            workingPixels, width, currentX + 1, currentY + 1,
            errorR * weightRightDown,
            errorG * weightRightDown,
            errorB * weightRightDown,
            colorMode
        );
    }
}

/**
 * Add weighted error to a specific pixel with color mode transformation
 *
 * @param {Uint8ClampedArray} workingPixels - Pixel array to modify
 * @param {number} width - Image width
 * @param {number} targetX - Target pixel X coordinate
 * @param {number} targetY - Target pixel Y coordinate
 * @param {number} weightedErrorR - Weighted red error to add
 * @param {number} weightedErrorG - Weighted green error to add
 * @param {number} weightedErrorB - Weighted blue error to add
 * @param {number} colorMode - Color processing mode
 */
function addWeightedErrorToPixel(
    workingPixels, width, targetX, targetY,
    weightedErrorR, weightedErrorG, weightedErrorB,
    colorMode
) {
    const pixelIndex = (targetX + targetY * width) * 4;

    // Get current pixel RGB values
    const currentR = workingPixels[pixelIndex];
    const currentG = workingPixels[pixelIndex + 1];
    const currentB = workingPixels[pixelIndex + 2];

    // Add weighted error to current values
    let newR = clampToValidRange(currentR + weightedErrorR);
    let newG = clampToValidRange(currentG + weightedErrorG);
    let newB = clampToValidRange(currentB + weightedErrorB);

    // Apply color mode transformation if specified
    const [finalR, finalG, finalB] = applyColorModeTransformation(newR, newG, newB, colorMode);

    // Write transformed values back to pixel array
    workingPixels[pixelIndex] = finalR;
    workingPixels[pixelIndex + 1] = finalG;
    workingPixels[pixelIndex + 2] = finalB;
    // Alpha channel remains unchanged
}

/**
 * Apply color mode transformation to RGB values
 *
 * Color modes provide artistic effects by remapping color channels:
 * - Mode 0 (Standard): R, G, B (no change)
 * - Mode 1 (Green-Blue emphasis): G, B, B
 * - Mode 2 (Color rotation): G, B, R
 * - Mode 3 (Blue emphasis): B, G, R
 * - Mode 4 (Custom mix): B, R, G
 *
 * @param {number} r - Red channel value (0-255)
 * @param {number} g - Green channel value (0-255)
 * @param {number} b - Blue channel value (0-255)
 * @param {number} colorMode - Color mode (0-4)
 * @returns {Array<number>} Transformed RGB values [r, g, b]
 */
function applyColorModeTransformation(r, g, b, colorMode) {
    switch (colorMode) {
        case 1: // Green-Blue emphasis - creates cooler tones
            return [g, b, b];

        case 2: // Color rotation - shifts color spectrum
            return [g, b, r];

        case 3: // Blue emphasis - emphasizes blue channel
            return [b, g, r];

        case 4: // Custom mix - unique color combination
            return [b, r, g];

        case 0: // Standard RGB - no transformation
        default:
            return [r, g, b];
    }
}

/**
 * Clamp a value to valid RGB range (0-255)
 *
 * This function ensures that pixel values stay within the valid range
 * after error accumulation, preventing overflow and underflow.
 *
 * @param {number} value - Value to clamp
 * @returns {number} Clamped value between 0 and 255
 */
function clampToValidRange(value) {
    return Math.min(255, Math.max(0, Math.round(value)));
}