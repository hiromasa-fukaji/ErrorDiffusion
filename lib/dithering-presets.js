/**
 * Floyd-Steinberg Dithering Presets Collection
 *
 * This module contains predefined configurations for different dithering styles.
 * Each preset defines error diffusion weights, threshold values, and color modes
 * that create distinct visual effects.
 *
 * Error Diffusion Pattern (Floyd-Steinberg):
 *   Current → Right (weight[0])
 *      ↓       ↓
 * Left-Down  Down  Right-Down
 * (weight[1]) (weight[2]) (weight[3])
 *
 * Standard Floyd-Steinberg weights: [7/16, 3/16, 5/16, 1/16]
 *
 * @version 1.0.0
 * @author Based on Signal v3 presets by synthymental.com
 */

/**
 * Collection of dithering presets
 * Each preset contains:
 * - name: Display name for the preset
 * - weights: Error diffusion weights [right, left-down, down, right-down]
 * - threshold: Binarization threshold (0-255)
 * - colorMode: Color transformation mode (0-4)
 * - description: Detailed description of the preset's characteristics
 * - characteristics: Technical details about the preset's behavior
 */
export const DITHERING_PRESETS = {

    /**
     * Classic Floyd-Steinberg Algorithm
     * The original algorithm as published by Robert Floyd and Louis Steinberg in 1976.
     * Provides excellent balance between quality and processing speed.
     */
    'floyd-steinberg': {
        name: 'Floyd-Steinberg',
        weights: [7/16, 3/16, 5/16, 1/16], // Classic mathematical ratios
        threshold: 127,                      // Neutral threshold (middle of 0-255 range)
        colorMode: 0,                        // Standard RGB processing
        description: 'Classic error diffusion algorithm providing balanced, high-quality dithering',
        characteristics: {
            quality: 'High',
            speed: 'Medium',
            contrast: 'Balanced',
            grain: 'Fine, even distribution',
            bestFor: 'General purpose, photographs, detailed images'
        }
    },

    /**
     * Anatoly Preset - Apple Macintosh Style
     * Named after early Apple computer systems, this preset creates high-contrast
     * results reminiscent of classic Macintosh bitmap graphics.
     */
    'anatoly': {
        name: 'Anatoly',
        weights: [1, 1/8, 1/8, 1/8],        // Heavy bias toward right pixel
        threshold: 200,                      // High threshold for high contrast
        colorMode: 3,                        // Blue emphasis (B, G, R)
        description: 'Apple Macintosh style with high contrast and distinctive grain pattern',
        characteristics: {
            quality: 'High',
            speed: 'Medium',
            contrast: 'Very High',
            grain: 'Distinctive, computer-graphics style',
            bestFor: 'Retro aesthetics, high-contrast images, logos'
        }
    },

    /**
     * Baker Preset - High-Speed Processing
     * Optimized for speed by eliminating error diffusion to right and right-down pixels.
     * Trades some quality for significantly improved processing speed.
     */
    'baker': {
        name: 'Baker',
        weights: [0, 1, 1/8, 0],            // No right/right-down diffusion for speed
        threshold: 27,                       // Very low threshold
        colorMode: 2,                        // Color rotation (G, B, R)
        description: 'Faster version of Floyd-Steinberg with simplified error diffusion',
        characteristics: {
            quality: 'Medium',
            speed: 'Very High',
            contrast: 'Low to Medium',
            grain: 'Vertical emphasis pattern',
            bestFor: 'Real-time processing, large images, speed-critical applications'
        }
    },

    /**
     * Gragas Preset - Smooth Gradients
     * Designed for images with smooth gradients and subtle tonal transitions.
     * Uses extreme threshold and right-only error diffusion.
     */
    'gragas': {
        name: 'Gragas',
        weights: [1, 0, 0, 0],              // Error diffusion only to the right
        threshold: 252,                      // Extremely high threshold
        colorMode: 4,                        // Custom mix (B, R, G)
        description: 'Smooth error diffusion optimized for gradient-rich images',
        characteristics: {
            quality: 'Specialized',
            speed: 'High',
            contrast: 'Very Low',
            grain: 'Horizontal streaking, smooth gradients',
            bestFor: 'Gradients, sky images, smooth color transitions'
        }
    },

    /**
     * RedbullVodka Preset - Simplified Sierra-style
     * Inspired by the Sierra dithering algorithm but simplified.
     * Strong downward error diffusion creates distinctive patterns.
     */
    'redbullvodka': {
        name: 'RedbullVodka',
        weights: [0.02, 0.02, 0.84, 0],     // Heavy concentration on down pixel
        threshold: 13,                       // Very low threshold for dark emphasis
        colorMode: 3,                        // Blue emphasis (B, G, R)
        description: 'Simplified Sierra-style with strong downward error diffusion',
        characteristics: {
            quality: 'Distinctive',
            speed: 'High',
            contrast: 'Variable',
            grain: 'Strong vertical patterns, unique texture',
            bestFor: 'Artistic effects, textural images, experimental results'
        }
    },

    /**
     * Kotik Preset - High-Quality Processing
     * Balanced between Floyd-Steinberg's right and left-down distribution.
     * Designed for maximum quality output with detailed preservation.
     */
    'kotik': {
        name: 'Kotik',
        weights: [0.23, 0.64, 0, 0],        // Focus on right and left-down pixels
        threshold: 254,                      // Near-maximum threshold
        colorMode: 3,                        // Blue emphasis (B, G, R)
        description: 'High-quality diffusion with excellent detail preservation',
        characteristics: {
            quality: 'Very High',
            speed: 'Medium',
            contrast: 'Low',
            grain: 'Very fine, diagonal patterns',
            bestFor: 'High-quality output, detailed images, professional work'
        }
    },

    /**
     * Moh Preset - Professional Quality
     * Professional-grade preset optimized for balanced results across various image types.
     * Conservative approach with controlled error diffusion.
     */
    'moh': {
        name: 'Moh',
        weights: [0.72, 0, 0, 0],           // Strong right-only diffusion
        threshold: 127,                      // Neutral threshold
        colorMode: 1,                        // Green-Blue emphasis (G, B, B)
        description: 'Professional quality with controlled error diffusion',
        characteristics: {
            quality: 'High',
            speed: 'High',
            contrast: 'Balanced',
            grain: 'Clean horizontal emphasis',
            bestFor: 'Professional output, consistent results, production work'
        }
    }
};

/**
 * Get all available preset names
 * @returns {Array<string>} Array of preset names
 */
export function getPresetNames() {
    return Object.keys(DITHERING_PRESETS);
}

/**
 * Get a specific preset by name
 * @param {string} presetName - Name of the preset
 * @returns {Object|null} Preset configuration or null if not found
 */
export function getPreset(presetName) {
    return DITHERING_PRESETS[presetName] || null;
}

/**
 * Get presets filtered by characteristics
 * @param {Object} filters - Filter criteria
 * @param {string} filters.quality - Quality level ('High', 'Medium', etc.)
 * @param {string} filters.speed - Speed level ('High', 'Medium', etc.)
 * @param {string} filters.contrast - Contrast level ('High', 'Medium', 'Low')
 * @returns {Object} Filtered presets object
 */
export function getFilteredPresets(filters = {}) {
    const result = {};

    for (const [name, preset] of Object.entries(DITHERING_PRESETS)) {
        let matches = true;

        if (filters.quality && preset.characteristics.quality !== filters.quality) {
            matches = false;
        }
        if (filters.speed && preset.characteristics.speed !== filters.speed) {
            matches = false;
        }
        if (filters.contrast && preset.characteristics.contrast !== filters.contrast) {
            matches = false;
        }

        if (matches) {
            result[name] = preset;
        }
    }

    return result;
}

/**
 * Validate a custom preset configuration
 * @param {Object} presetConfig - Preset configuration to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
export function validatePresetConfig(presetConfig) {
    const result = { isValid: true, errors: [] };

    // Check required properties
    if (!presetConfig || typeof presetConfig !== 'object') {
        result.isValid = false;
        result.errors.push('Preset configuration must be an object');
        return result;
    }

    // Validate weights array
    if (!Array.isArray(presetConfig.weights)) {
        result.isValid = false;
        result.errors.push('Weights must be an array');
    } else if (presetConfig.weights.length !== 4) {
        result.isValid = false;
        result.errors.push('Weights array must contain exactly 4 values');
    } else {
        // Check if all weights are numbers
        for (let i = 0; i < 4; i++) {
            if (typeof presetConfig.weights[i] !== 'number') {
                result.isValid = false;
                result.errors.push(`Weight ${i} must be a number`);
            }
        }
    }

    // Validate threshold
    if (typeof presetConfig.threshold !== 'number') {
        result.isValid = false;
        result.errors.push('Threshold must be a number');
    } else if (presetConfig.threshold < 0 || presetConfig.threshold > 255) {
        result.isValid = false;
        result.errors.push('Threshold must be between 0 and 255');
    }

    // Validate color mode
    if (presetConfig.colorMode !== undefined) {
        if (typeof presetConfig.colorMode !== 'number') {
            result.isValid = false;
            result.errors.push('Color mode must be a number');
        } else if (presetConfig.colorMode < 0 || presetConfig.colorMode > 4) {
            result.isValid = false;
            result.errors.push('Color mode must be between 0 and 4');
        }
    }

    return result;
}

/**
 * Create a custom preset with validation
 * @param {string} name - Name for the custom preset
 * @param {Object} config - Preset configuration
 * @returns {Object} The created preset or null if invalid
 */
export function createCustomPreset(name, config) {
    const validation = validatePresetConfig(config);

    if (!validation.isValid) {
        console.error('Invalid preset configuration:', validation.errors);
        return null;
    }

    const customPreset = {
        name: config.name || name,
        weights: [...config.weights],
        threshold: config.threshold,
        colorMode: config.colorMode || 0,
        description: config.description || 'Custom preset',
        characteristics: config.characteristics || {
            quality: 'Custom',
            speed: 'Unknown',
            contrast: 'Variable',
            grain: 'Custom pattern',
            bestFor: 'Custom applications'
        }
    };

    return customPreset;
}

/**
 * Color mode explanations
 * Detailed descriptions of what each color mode does
 */
export const COLOR_MODE_DESCRIPTIONS = {
    0: {
        name: 'Standard RGB',
        transformation: 'R, G, B (no change)',
        description: 'Normal color processing - no channel remapping',
        effect: 'Natural color reproduction'
    },
    1: {
        name: 'Green-Blue Emphasis',
        transformation: 'G, B, B',
        description: 'Red channel replaced with green, blue channel doubled',
        effect: 'Cooler tones, reduced red content'
    },
    2: {
        name: 'Color Rotation',
        transformation: 'G, B, R',
        description: 'RGB channels rotated: Red→Blue, Green→Red, Blue→Green',
        effect: 'Shifted color spectrum, psychedelic colors'
    },
    3: {
        name: 'Blue Emphasis',
        transformation: 'B, G, R',
        description: 'Blue channel in red position, color order reversed',
        effect: 'Strong blue tinting, inverted color relationships'
    },
    4: {
        name: 'Custom Mix',
        transformation: 'B, R, G',
        description: 'Blue→Red, Red→Green, Green→Blue channel mapping',
        effect: 'Unique color combinations, artistic effects'
    }
};

/**
 * Get color mode description
 * @param {number} colorMode - Color mode number (0-4)
 * @returns {Object|null} Color mode description or null if invalid
 */
export function getColorModeDescription(colorMode) {
    return COLOR_MODE_DESCRIPTIONS[colorMode] || null;
}