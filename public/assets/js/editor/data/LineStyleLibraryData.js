/**
 * LineStyleLibraryData.js
 * Rich line style presets for the template editor.
 */

const CURATED_PRESETS = [
    // Basic
    { id: 'line_01', name: 'Basic Clean', category: 'basic', stroke: '#111827', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_02', name: 'Basic Strong', category: 'basic', stroke: '#0f172a', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_03', name: 'Accent Blue', category: 'basic', stroke: '#2563eb', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_04', name: 'Accent Green', category: 'basic', stroke: '#16a34a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },

    // Dashed
    { id: 'line_05', name: 'Short Dash', category: 'dashed', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [10, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_06', name: 'Long Dash', category: 'dashed', stroke: '#111827', strokeWidth: 3, strokeDashArray: [24, 10], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_07', name: 'Equal Dash', category: 'dashed', stroke: '#334155', strokeWidth: 3, strokeDashArray: [12, 12], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_08', name: 'Dense Dash', category: 'dashed', stroke: '#475569', strokeWidth: 2, strokeDashArray: [7, 4], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_09', name: 'Dash Dot Flow', category: 'dashed', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: [18, 7, 2, 7], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_10', name: 'Dash Dot Rhythm', category: 'dashed', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [18, 7, 2, 7, 2, 7], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Dotted
    { id: 'line_11', name: 'Micro Dots', category: 'dotted', stroke: '#334155', strokeWidth: 2, strokeDashArray: [1, 6], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_12', name: 'Soft Dots', category: 'dotted', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [1, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_13', name: 'Wide Dots', category: 'dotted', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: [1, 16], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_14', name: 'Pixel Dots', category: 'dotted', stroke: '#475569', strokeWidth: 2, strokeDashArray: [2, 7], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },

    // Decorative
    { id: 'line_15', name: 'Rail Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: [30, 6, 4, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_16', name: 'Pulse Divider', category: 'decorative', stroke: '#7c3aed', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'pulseWave' },
    { id: 'line_17', name: 'Wave Soft', category: 'decorative', stroke: '#2563eb', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'wave' },
    { id: 'line_18', name: 'Wave Bold', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'scallop' },
    { id: 'line_19', name: 'Zigzag Sharp', category: 'decorative', stroke: '#ef4444', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'zigzag' },
    { id: 'line_20', name: 'Zigzag Calm', category: 'decorative', stroke: '#f97316', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chevron' },
    { id: 'line_21', name: 'Step Tech', category: 'decorative', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'step' },
    { id: 'line_22', name: 'Step Bold', category: 'decorative', stroke: '#1e293b', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'notch' },
    { id: 'line_23', name: 'Bracket Minimal', category: 'decorative', stroke: '#16a34a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bracket' },
    { id: 'line_24', name: 'Bracket Bold', category: 'decorative', stroke: '#0891b2', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'arc' },

    // Basic (extended)
    { id: 'line_25', name: 'Basic Slate', category: 'basic', stroke: '#334155', strokeWidth: 1, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_26', name: 'Basic Indigo', category: 'basic', stroke: '#4338ca', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_27', name: 'Basic Teal', category: 'basic', stroke: '#0f766e', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_28', name: 'Basic Rose', category: 'basic', stroke: '#be123c', strokeWidth: 6, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_29', name: 'Basic Amber', category: 'basic', stroke: '#d97706', strokeWidth: 8, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_30', name: 'Basic Neutral', category: 'basic', stroke: '#525252', strokeWidth: 7, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Dashed (extended)
    { id: 'line_31', name: 'Dash Compact', category: 'dashed', stroke: '#1f2937', strokeWidth: 2, strokeDashArray: [8, 5], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_32', name: 'Dash Wide', category: 'dashed', stroke: '#0f172a', strokeWidth: 4, strokeDashArray: [30, 12], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_33', name: 'Dash Medium', category: 'dashed', stroke: '#374151', strokeWidth: 3, strokeDashArray: [16, 8], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_34', name: 'Dash Alternating', category: 'dashed', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [18, 6, 8, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_35', name: 'Dash Focus', category: 'dashed', stroke: '#475569', strokeWidth: 4, strokeDashArray: [20, 5, 3, 5], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_36', name: 'Dash Marker', category: 'dashed', stroke: '#334155', strokeWidth: 3, strokeDashArray: [14, 4, 2, 4, 2, 8], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_37', name: 'Dash Bold Cut', category: 'dashed', stroke: '#111827', strokeWidth: 5, strokeDashArray: [22, 10], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },

    // Dotted (extended)
    { id: 'line_38', name: 'Dot Compact', category: 'dotted', stroke: '#334155', strokeWidth: 2, strokeDashArray: [1, 5], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_39', name: 'Dot Medium', category: 'dotted', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [1, 8], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_40', name: 'Dot Long Gap', category: 'dotted', stroke: '#0f172a', strokeWidth: 4, strokeDashArray: [1, 14], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_41', name: 'Dot Square', category: 'dotted', stroke: '#475569', strokeWidth: 2, strokeDashArray: [2, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_42', name: 'Dot Duo', category: 'dotted', stroke: '#64748b', strokeWidth: 3, strokeDashArray: [2, 4, 2, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_43', name: 'Dot Fine', category: 'dotted', stroke: '#6b7280', strokeWidth: 2, strokeDashArray: [1, 4], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Decorative (extended)
    { id: 'line_44', name: 'Wave Mint', category: 'decorative', stroke: '#10b981', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chain' },
    { id: 'line_45', name: 'Wave Violet', category: 'decorative', stroke: '#8b5cf6', strokeWidth: 6, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ribbon' },
    { id: 'line_46', name: 'Zigzag Neon', category: 'decorative', stroke: '#06b6d4', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'stitch' },
    { id: 'line_47', name: 'Zigzag Bold', category: 'decorative', stroke: '#f43f5e', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'skyline' },
    { id: 'line_48', name: 'Step Cyan', category: 'decorative', stroke: '#0891b2', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'ticket' },
    { id: 'line_49', name: 'Step Graphite', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'hook' },
    { id: 'line_50', name: 'Bracket Accent', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'twinline' },

    // Divider / Line Studio (Section 4 additions)
    { id: 'line_51', name: 'Basic Solid Thin', category: 'basic', stroke: '#1f2937', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'basic-solid-thin' },
    { id: 'line_52', name: 'Basic Solid Medium', category: 'basic', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'basic-solid-medium' },
    { id: 'line_53', name: 'Basic Solid Thick', category: 'basic', stroke: '#1f2937', strokeWidth: 7, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'basic-solid-thick' },
    { id: 'line_54', name: 'Rounded Cap Line', category: 'basic', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_55', name: 'Center Dot Divider', category: 'basic', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chain' },
    { id: 'line_56', name: 'Center Diamond Divider', category: 'basic', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chevron' },
    { id: 'line_57', name: 'Center Circle Divider', category: 'basic', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chain' },
    { id: 'line_58', name: 'Short End Caps Divider', category: 'basic', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bracket' },
    { id: 'line_59', name: 'Inset Solid Divider', category: 'basic', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_60', name: 'Minimal Hairline', category: 'basic', stroke: '#1f2937', strokeWidth: 1, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'minimal-hairline' },

    { id: 'line_61', name: 'Dashed Classic', category: 'dashed', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [18, 12], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_62', name: 'Dashed Wide', category: 'dashed', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: [34, 16], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_63', name: 'Dashed Rounded', category: 'dashed', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: [22, 12], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_64', name: 'Dotted Classic', category: 'dotted', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: [1, 14], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'dotted-classic' },
    { id: 'line_65', name: 'Dotted Dense', category: 'dotted', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [1, 8], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'dotted-dense' },
    { id: 'line_66', name: 'Dot Dash', category: 'dashed', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [1, 10, 24, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_67', name: 'Center Gap Dash', category: 'dashed', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [18, 10, 30, 22, 18, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_68', name: 'Double Dash', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [18, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'twinline' },
    { id: 'line_69', name: 'Double Line Clean', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'twinline' },
    { id: 'line_70', name: 'Double Line Center Dot', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'double-line-center-dot' },
    { id: 'line_71', name: 'Double Line Center Diamond', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ribbon' },
    { id: 'line_72', name: 'Triple Dot Divider', category: 'dotted', stroke: '#1f2937', strokeWidth: 5, strokeDashArray: [1, 12], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    { id: 'line_73', name: 'Ribbon Divider', category: 'decorative', stroke: '#1f2937', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ribbon' },
    { id: 'line_74', name: 'Premium Gold Center Seal', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-gold-center-seal' },
    { id: 'line_75', name: 'Premium Gold Diamond', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-gold-diamond' },
    { id: 'line_76', name: 'Ramadan Crescent Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'arc' },
    { id: 'line_77', name: 'Ramadan Lantern Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ramadan-lantern-divider' },
    { id: 'line_78', name: 'Islamic Star Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'islamic-star-divider' },
    { id: 'line_79', name: 'National Star Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chevron' },
    { id: 'line_80', name: 'National Ribbon Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'national-ribbon-divider' },
    { id: 'line_81', name: 'New Year Sparkle Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'new-year-sparkle-divider' },
    { id: 'line_82', name: 'Campaign Arrow Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'hook' },
    { id: 'line_83', name: 'Promo Burst Divider', category: 'decorative', stroke: '#ef4444', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'scallop' },
    { id: 'line_84', name: 'Price Tag Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ticket' },
    { id: 'line_85', name: 'Price Window Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-window-divider' },
    { id: 'line_86', name: 'Floral Spring Divider', category: 'decorative', stroke: '#16a34a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'floral-spring-divider' },
    { id: 'line_87', name: 'Leaf Vine Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'wave' },
    { id: 'line_88', name: 'Tech Neon Divider', category: 'decorative', stroke: '#38bdf8', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'skyline' },
    { id: 'line_89', name: 'Tech Node Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'tech-node-divider' },
    { id: 'line_90', name: 'HUD Divider', category: 'decorative', stroke: '#38bdf8', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bracket' },
    { id: 'line_91', name: 'Confetti Divider', category: 'decorative', stroke: '#7c3aed', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'stitch' },
    { id: 'line_92', name: 'Ornamental Curl Light', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ornamental-curl-light' },
    { id: 'line_93', name: 'Ornamental Diamond Chain', category: 'decorative', stroke: '#374151', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chain' },

    // Divider / Line Studio (missing names from Section 4)
    { id: 'line_94', name: 'Bayram Elegant Line', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bayram-elegant-line' },
    { id: 'line_95', name: 'Bayram Ornament Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bayram-ornament' },
    { id: 'line_96', name: 'Bloom Accent Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bloom-accent-divider' },
    { id: 'line_97', name: 'Blue Screen Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'blue-screen-divider' },
    { id: 'line_98', name: 'Campaign Bracket Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'campaign-bracket-divider' },
    { id: 'line_99', name: 'Campaign Highlight Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'campaign-highlight-divider' },
    { id: 'line_100', name: 'Celebration Dot Line', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'celebration-dot-line' },
    { id: 'line_101', name: 'Circuit Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'circuit-divider' },
    { id: 'line_102', name: 'Classic Scroll Divider', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'classic-scroll' },
    { id: 'line_103', name: 'Data Rail Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'data-rail-divider' },
    { id: 'line_104', name: 'Digital Pulse Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'digital-pulse-divider' },
    { id: 'line_105', name: 'Discount Focus Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'discount-focus-divider' },
    { id: 'line_106', name: 'Discount Price Rail', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'discount-price-rail' },
    { id: 'line_107', name: 'Discount Ticket Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'discount-ticket-divider' },
    { id: 'line_108', name: 'Double Line Offset', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'double-offset' },
    { id: 'line_109', name: 'Double Line Premium', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'double-premium' },
    { id: 'line_110', name: 'Double Line Rounded', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'double-rounded' },
    { id: 'line_111', name: 'Double Line Thin Thick', category: 'decorative', stroke: '#1f2937', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'double-thin-thick' },
    { id: 'line_112', name: 'Festive Gold Line', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'festive-gold-line' },
    { id: 'line_113', name: 'Flag Stripe Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'flag-stripe-divider' },
    { id: 'line_114', name: 'Flower Corner Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'flower-corner-divider' },
    { id: 'line_115', name: 'Formal State Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'formal-state-divider' },
    { id: 'line_116', name: 'Fresh Market Floral', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'fresh-market-floral' },
    { id: 'line_117', name: 'Futuristic Bracket Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'futuristic-bracket-divider' },
    { id: 'line_118', name: 'Garden Light Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'garden-light-divider' },
    { id: 'line_119', name: 'Gift Ribbon Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'gift-ribbon-divider' },
    { id: 'line_120', name: 'Hilal Double Line', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'hilal-double-line' },
    { id: 'line_121', name: 'Holiday Light Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'holiday-light-divider' },
    { id: 'line_122', name: 'Islamic Geometry Line', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'islamic-geometry-line' },
    { id: 'line_123', name: 'Lantern Chain Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'lantern-chain' },
    { id: 'line_124', name: 'Leaf Ornament Divider', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'leaf-ornament' },
    { id: 'line_125', name: 'Leaf Twin Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'leaf-twin-divider' },
    { id: 'line_126', name: 'Luxury Black Gold', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'luxury-black-gold-line' },
    { id: 'line_127', name: 'Luxury Thin Gold', category: 'decorative', stroke: '#d4a017', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'luxury-thin-gold' },
    { id: 'line_128', name: 'Mosque Arch Divider', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'mosque-arch-divider' },
    { id: 'line_129', name: 'National Circle Mark', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'national-circle-mark' },
    { id: 'line_130', name: 'National Crest Line', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'national-crest-line' },
    { id: 'line_131', name: 'National Double Star', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'national-double-star' },
    { id: 'line_132', name: 'National Thin Ribbon', category: 'decorative', stroke: '#dc2626', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'national-thin-ribbon' },
    { id: 'line_133', name: 'New Year Burst Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'new-year-burst-divider' },
    { id: 'line_134', name: 'Opening Banner Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'opening-banner-divider' },
    { id: 'line_135', name: 'Opening Ribbon Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'opening-ribbon-divider' },
    { id: 'line_136', name: 'Ornamental Baroque Small', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'baroque-small' },
    { id: 'line_137', name: 'Ornamental Baroque Wide', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'baroque-wide' },
    { id: 'line_138', name: 'Ornamental Curl Medium', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'curl-medium' },
    { id: 'line_139', name: 'Ornamental Teardrop', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'teardrop' },
    { id: 'line_140', name: 'Petal Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'petal-divider' },
    { id: 'line_141', name: 'Pixel Break Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'pixel-break-divider' },
    { id: 'line_142', name: 'POS Price Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'pos-price-divider' },
    { id: 'line_143', name: 'Premium Angular Divider', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-angular' },
    { id: 'line_144', name: 'Premium Circle Accent', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-circle-accent' },
    { id: 'line_145', name: 'Premium Crest Divider', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-crest' },
    { id: 'line_146', name: 'Premium Jewel Divider', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-jewel' },
    { id: 'line_147', name: 'Premium Medallion', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-medallion' },
    { id: 'line_148', name: 'Premium Twin Accent', category: 'decorative', stroke: '#d4a017', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'premium-twin-accent' },
    { id: 'line_149', name: 'Price Cut Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-cut-divider' },
    { id: 'line_150', name: 'Price Dot Line', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-dot-line' },
    { id: 'line_151', name: 'Price Focus Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-focus-divider' },
    { id: 'line_152', name: 'Price Label Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-label-divider' },
    { id: 'line_153', name: 'Price Marker Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'price-marker-divider' },
    { id: 'line_154', name: 'Promo Chevron Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'promo-chevron-divider' },
    { id: 'line_155', name: 'Ramadan Side Stars', category: 'decorative', stroke: '#0f766e', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ramadan-side-stars' },
    { id: 'line_156', name: 'Republic Accent Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'republic-accent-divider' },
    { id: 'line_157', name: 'Retail Shelf Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'retail-shelf-divider' },
    { id: 'line_158', name: 'Rose Dot Divider', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'rose-dot-divider' },
    { id: 'line_159', name: 'Sale Marker Divider', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'sale-marker-divider' },
    { id: 'line_160', name: 'Scanline Divider', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'scanline-divider' },
    { id: 'line_161', name: 'Snow Dot Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'snow-dot-divider' },
    { id: 'line_162', name: 'Soft Bloom Line', category: 'decorative', stroke: '#15803d', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'soft-bloom-line' },
    { id: 'line_163', name: 'Sparkle Center Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'sparkle-center-divider' },
    { id: 'line_164', name: 'Symmetric Ornament', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'symmetric-ornament' },
    { id: 'line_165', name: 'Triple Line Minimal', category: 'decorative', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'triple-minimal' },
    { id: 'line_166', name: 'Victory Day Divider', category: 'decorative', stroke: '#dc2626', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'victory-day-divider' },
    { id: 'line_167', name: 'Vintage Flourish', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'vintage-flourish' },
    { id: 'line_168', name: 'Winter Crystal Divider', category: 'decorative', stroke: '#d97706', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'winter-crystal-divider' }
];

export const LINE_CATEGORIES = ['all', 'basic', 'dashed', 'dotted', 'decorative'];

export const LINE_STYLE_MAP = {
    solid: null,
    dashed: [10, 6],
    longDashed: [20, 10],
    dotted: [2, 10],
    dashDot: [16, 6, 2, 6],
    dashDotDot: [16, 6, 2, 6, 2, 6],
    denseDash: [6, 4],
    sparseDot: [2, 14]
};

export function dashArrayFromStyle(styleId) {
    return LINE_STYLE_MAP[styleId] || null;
}

export const LINE_PRESETS = CURATED_PRESETS;

export function getLinePresetsByCategory(category = 'all') {
    if (!category || category === 'all') return LINE_PRESETS;
    return LINE_PRESETS.filter((p) => p.category === category);
}

export function searchLinePresets(query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return LINE_PRESETS;
    return LINE_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
}
