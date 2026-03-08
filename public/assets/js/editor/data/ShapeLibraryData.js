/**
 * ShapeLibraryData.js
 * 59 retail-focused SVG shapes for the template editor.
 * Extracted from shape_library_v2.html
 *
 * Each shape has:
 *   id, name, category, tags, variants, radiusMode, draw(opts)
 *
 * draw({fillRef, strokeWidth, variant, radius}) → SVG inner markup
 * SVG viewBox is 0 0 1024 720
 */

// ─── helpers ─────────────────────────────────────────────────────
const BASE_COMMON = (sw) =>
    `stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;

function shapeByVariant(variant, solid, outline, doubleV) {
    if (variant === 'outline') return outline;
    if (variant === 'double') return doubleV || solid;
    return solid;
}

function burstPath(points, inner, outer, attrs) {
    const cx = 512, cy = 360;
    let d = '';
    for (let i = 0; i < points * 2; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI / points);
        const r = i % 2 === 0 ? outer : inner;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    d += 'Z';
    return `<path d="${d}" ${attrs}/>`;
}

function burstVariant(points, inner, outer, fillRef, strokeWidth, variant) {
    const solid   = burstPath(points, inner, outer, `fill="${fillRef}" ${BASE_COMMON(strokeWidth)}`);
    const outline = burstPath(points, inner, outer, `fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 36)}"`);
    const doubleV = burstPath(points, inner, outer, `fill="${fillRef}" ${BASE_COMMON(strokeWidth)}`)
                  + burstPath(points, inner - 44, outer - 44, `fill="none" stroke="currentColor" stroke-width="12"`);
    return shapeByVariant(variant, solid, outline, doubleV);
}

// ─── draw functions ──────────────────────────────────────────────

function roundedRectShape({ fillRef, strokeWidth, variant, radius }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<rect x="120" y="180" width="784" height="360" rx="${radius}" ry="${radius}" fill="${fillRef}" ${c}/>`,
        `<rect x="120" y="180" width="784" height="360" rx="${radius}" ry="${radius}" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 44)}"/>`,
        `<rect x="120" y="180" width="784" height="360" rx="${radius}" ry="${radius}" fill="${fillRef}" ${c}/><rect x="168" y="228" width="688" height="264" rx="${Math.max(0, radius - 18)}" ry="${Math.max(0, radius - 18)}" fill="none" stroke="currentColor" stroke-width="18"/>`
    );
}

function pillShape({ fillRef, strokeWidth, variant }) {
    return roundedRectShape({ fillRef, strokeWidth, variant, radius: 140 });
}

function angledBannerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M120 220 H860 L930 360 L860 500 H120 L190 360 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M120 220 H860 L930 360 L860 500 H120 L190 360 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 44)}"/>`,
        `<path d="M120 220 H860 L930 360 L860 500 H120 L190 360 Z" fill="${fillRef}" ${c}/><path d="M220 270 H790 L836 360 L790 450 H220 L266 360 Z" fill="none" stroke="currentColor" stroke-width="18"/>`
    );
}

function diagonalRibbonShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M140 240 L760 140 L884 300 L264 400 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M140 240 L760 140 L884 300 L264 400 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/>`,
        `<path d="M140 240 L760 140 L884 300 L264 400 Z" fill="${fillRef}" ${c}/><path d="M228 258 L740 176 L818 286 L306 368 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function doubleRibbonShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M140 270 H884 L814 360 L884 450 H140 L210 360 Z" fill="${fillRef}" ${c}/><path d="M250 450 L180 590 L340 500 Z" fill="${fillRef}" ${c}/><path d="M774 450 L844 590 L684 500 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M140 270 H884 L814 360 L884 450 H140 L210 360 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 36)}"/><path d="M250 450 L180 590 L340 500 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 36)}"/><path d="M774 450 L844 590 L684 500 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 36)}"/>`,
        `<path d="M140 270 H884 L814 360 L884 450 H140 L210 360 Z" fill="${fillRef}" ${c}/><path d="M250 450 L180 590 L340 500 Z" fill="${fillRef}" ${c}/><path d="M774 450 L844 590 L684 500 Z" fill="${fillRef}" ${c}/><path d="M240 312 H784 L744 360 L784 408 H240 L280 360 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function circleBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<circle cx="512" cy="360" r="250" fill="${fillRef}" ${c}/>`,
        `<circle cx="512" cy="360" r="250" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 44)}"/>`,
        `<circle cx="512" cy="360" r="250" fill="${fillRef}" ${c}/><circle cx="512" cy="360" r="196" fill="none" stroke="currentColor" stroke-width="18"/>`
    );
}

function circleOutlineBadgeShape({ strokeWidth }) {
    return `<circle cx="512" cy="360" r="250" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 48)}"/>`;
}

function ovalBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<ellipse cx="512" cy="360" rx="310" ry="210" fill="${fillRef}" ${c}/>`,
        `<ellipse cx="512" cy="360" rx="310" ry="210" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 44)}"/>`,
        `<ellipse cx="512" cy="360" rx="310" ry="210" fill="${fillRef}" ${c}/><ellipse cx="512" cy="360" rx="252" ry="152" fill="none" stroke="currentColor" stroke-width="18"/>`
    );
}

function roundedSquareShape({ fillRef, strokeWidth, variant, radius }) {
    const c = BASE_COMMON(strokeWidth);
    const r = Math.min(radius + 50, 180);
    return shapeByVariant(variant,
        `<rect x="232" y="120" width="560" height="560" rx="${r}" fill="${fillRef}" ${c}/>`,
        `<rect x="232" y="120" width="560" height="560" rx="${r}" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 44)}"/>`,
        `<rect x="232" y="120" width="560" height="560" rx="${r}" fill="${fillRef}" ${c}/><rect x="286" y="174" width="452" height="452" rx="${Math.max(0, Math.min(radius + 10, 140))}" fill="none" stroke="currentColor" stroke-width="18"/>`
    );
}

function starburstShape({ fillRef, strokeWidth, variant }) {
    return burstVariant(16, 170, 260, fillRef, strokeWidth, variant);
}

function burstExplosionShape({ fillRef, strokeWidth, variant }) {
    return burstVariant(24, 160, 270, fillRef, strokeWidth, variant);
}

function priceTagShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M180 180 H690 L860 350 L690 520 H180 Z" fill="${fillRef}" ${c}/><circle cx="690" cy="350" r="44" fill="#fff" opacity="0.92"/>`,
        `<path d="M180 180 H690 L860 350 L690 520 H180 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 42)}"/><circle cx="690" cy="350" r="38" fill="none" stroke="currentColor" stroke-width="18"/>`,
        `<path d="M180 180 H690 L860 350 L690 520 H180 Z" fill="${fillRef}" ${c}/><path d="M252 236 H652 L768 350 L652 464 H252 Z" fill="none" stroke="currentColor" stroke-width="16"/>`
    );
}

function couponTicketShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M170 220 H854 V290 C810 290 782 320 782 360 C782 400 810 430 854 430 V500 H170 V430 C214 430 242 400 242 360 C242 320 214 290 170 290 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M170 220 H854 V290 C810 290 782 320 782 360 C782 400 810 430 854 430 V500 H170 V430 C214 430 242 400 242 360 C242 320 214 290 170 290 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M170 220 H854 V290 C810 290 782 320 782 360 C782 400 810 430 854 430 V500 H170 V430 C214 430 242 400 242 360 C242 320 214 290 170 290 Z" fill="${fillRef}" ${c}/><path d="M246 260 H778 V304 C742 316 720 334 720 360 C720 386 742 404 778 416 V460 H246 V416 C282 404 304 386 304 360 C304 334 282 316 246 304 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function cornerRibbonShape({ fillRef, strokeWidth }) {
    return `<path d="M170 120 H460 L120 460 V170 Q120 120 170 120 Z" fill="${fillRef}" ${BASE_COMMON(strokeWidth)}/>`;
}

function cornerStickerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M140 140 H500 V220 H220 V500 H140 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M140 140 H500 V220 H220 V500 H140 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M140 140 H500 V220 H220 V500 H140 Z" fill="${fillRef}" ${c}/><path d="M184 184 H416 V228 H228 V416 H184 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function saleBadgeShape({ fillRef, strokeWidth }) {
    return `<path d="M512 120 L660 170 L820 170 L854 320 L930 450 L820 550 L780 700 L620 700 L512 820 L404 700 L244 700 L204 550 L94 450 L170 320 L204 170 L364 170 Z" fill="${fillRef}" ${BASE_COMMON(strokeWidth)}/>`;
}

function speechBubbleShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M160 170 H864 Q910 170 910 216 V450 Q910 496 864 496 H550 L420 620 L446 496 H160 Q114 496 114 450 V216 Q114 170 160 170 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M160 170 H864 Q910 170 910 216 V450 Q910 496 864 496 H550 L420 620 L446 496 H160 Q114 496 114 450 V216 Q114 170 160 170 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/>`,
        `<path d="M160 170 H864 Q910 170 910 216 V450 Q910 496 864 496 H550 L420 620 L446 496 H160 Q114 496 114 450 V216 Q114 170 160 170 Z" fill="${fillRef}" ${c}/><path d="M224 228 H800 V430 H512 L468 486 L480 430 H224 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function minimalBadgeShape({ fillRef, strokeWidth, variant, radius }) {
    return roundedRectShape({ fillRef, strokeWidth, variant, radius: Math.max(24, radius) });
}

function productHighlightFrameShape({ fillRef, variant, radius }) {
    return variant === 'double'
        ? `<rect x="170" y="110" width="684" height="500" rx="${radius}" fill="none" stroke="${fillRef}" stroke-width="66"/><rect x="228" y="168" width="568" height="384" rx="${Math.max(0, radius - 16)}" fill="none" stroke="currentColor" stroke-width="18"/>`
        : `<rect x="170" y="110" width="684" height="500" rx="${radius}" fill="none" stroke="${fillRef}" stroke-width="70"/>`;
}

function priceHighlightBoxShape({ fillRef, strokeWidth, variant, radius }) {
    return roundedRectShape({ fillRef, strokeWidth, variant, radius: Math.max(18, radius) });
}

function angledRectangleBannerShape({ fillRef, strokeWidth, variant }) {
    return angledBannerShape({ fillRef, strokeWidth, variant });
}

function modernGeometricBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M512 110 L784 240 V480 L512 610 L240 480 V240 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M512 110 L784 240 V480 L512 610 L240 480 V240 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 42)}"/>`,
        `<path d="M512 110 L784 240 V480 L512 610 L240 480 V240 Z" fill="${fillRef}" ${c}/><path d="M512 182 L716 286 V434 L512 538 L308 434 V286 Z" fill="none" stroke="currentColor" stroke-width="16"/>`
    );
}

function highlightStickerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M210 170 H720 L854 304 V560 H210 Z" fill="${fillRef}" ${c}/><path d="M720 170 V304 H854" fill="none" stroke="currentColor" stroke-width="24"/>`,
        `<path d="M210 170 H720 L854 304 V560 H210 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/><path d="M720 170 V304 H854" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 18)}"/>`,
        `<path d="M210 170 H720 L854 304 V560 H210 Z" fill="${fillRef}" ${c}/><path d="M720 170 V304 H854" fill="none" stroke="currentColor" stroke-width="18"/><path d="M268 226 H708 L792 310 V504 H268 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function diamondBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M512 90 L860 360 L512 630 L164 360 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M512 90 L860 360 L512 630 L164 360 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M512 90 L860 360 L512 630 L164 360 Z" fill="${fillRef}" ${c}/><path d="M512 164 L764 360 L512 556 L260 360 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function hexagonBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M310 130 H714 L916 360 L714 590 H310 L108 360 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M310 130 H714 L916 360 L714 590 H310 L108 360 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M310 130 H714 L916 360 L714 590 H310 L108 360 Z" fill="${fillRef}" ${c}/><path d="M346 200 H678 L824 360 L678 520 H346 L200 360 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function octagonBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M300 110 H724 L914 300 V420 L724 610 H300 L110 420 V300 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M300 110 H724 L914 300 V420 L724 610 H300 L110 420 V300 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M300 110 H724 L914 300 V420 L724 610 H300 L110 420 V300 Z" fill="${fillRef}" ${c}/><path d="M338 176 H686 L848 330 V390 L686 544 H338 L176 390 V330 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function triangleBannerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M512 100 L900 620 H124 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M512 100 L900 620 H124 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/>`,
        `<path d="M512 100 L900 620 H124 Z" fill="${fillRef}" ${c}/><path d="M512 190 L748 560 H276 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function shieldBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M512 110 L790 200 V390 C790 560 668 688 512 780 C356 688 234 560 234 390 V200 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M512 110 L790 200 V390 C790 560 668 688 512 780 C356 688 234 560 234 390 V200 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 40)}"/>`,
        `<path d="M512 110 L790 200 V390 C790 560 668 688 512 780 C356 688 234 560 234 390 V200 Z" fill="${fillRef}" ${c}/><path d="M512 180 L722 248 V392 C722 518 634 616 512 690 C390 616 302 518 302 392 V248 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function ticketLabelShape({ fillRef, strokeWidth, variant }) {
    return couponTicketShape({ fillRef, strokeWidth, variant });
}

function foldedCornerBannerShape({ fillRef, strokeWidth, variant }) {
    return highlightStickerShape({ fillRef, strokeWidth, variant });
}

function modernRibbonBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<circle cx="512" cy="300" r="180" fill="${fillRef}" ${c}/><path d="M390 450 L310 760 L512 620 L714 760 L634 450 Z" fill="${fillRef}" ${c}/>`,
        `<circle cx="512" cy="300" r="180" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/><path d="M390 450 L310 760 L512 620 L714 760 L634 450 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/>`,
        `<circle cx="512" cy="300" r="180" fill="${fillRef}" ${c}/><path d="M390 450 L310 760 L512 620 L714 760 L634 450 Z" fill="${fillRef}" ${c}/><circle cx="512" cy="300" r="132" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function doubleFlagBannerShape({ fillRef, strokeWidth }) {
    const c = BASE_COMMON(strokeWidth);
    return `<path d="M180 240 H844 V500 H180 Z" fill="${fillRef}" ${c}/><path d="M180 240 L100 370 L180 500" fill="${fillRef}" ${c}/><path d="M844 240 L924 370 L844 500" fill="${fillRef}" ${c}/>`;
}

function productSpotlightFrameShape({ fillRef, variant, radius }) {
    return productHighlightFrameShape({ fillRef, variant, radius });
}

function cornerFrameHighlightShape({ fillRef }) {
    return `<path d="M180 220 V140 H360" fill="none" stroke="${fillRef}" stroke-width="52"/><path d="M844 220 V140 H664" fill="none" stroke="${fillRef}" stroke-width="52"/><path d="M180 500 V580 H360" fill="none" stroke="${fillRef}" stroke-width="52"/><path d="M844 500 V580 H664" fill="none" stroke="${fillRef}" stroke-width="52"/>`;
}

function saleBurstCircleShape({ fillRef, strokeWidth, variant }) {
    return burstVariant(18, 215, 285, fillRef, strokeWidth, variant) + `<circle cx="512" cy="360" r="180" fill="#fff" opacity="0.16"/>`;
}

function starBadgeShape({ fillRef, strokeWidth, variant }) {
    return burstVariant(5, 170, 300, fillRef, strokeWidth, variant);
}

function angledPillBannerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M210 240 H734 Q834 240 864 340 Q894 440 814 500 Q784 520 734 520 H290 Q190 520 160 420 Q130 320 210 260 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M210 240 H734 Q834 240 864 340 Q894 440 814 500 Q784 520 734 520 H290 Q190 520 160 420 Q130 320 210 260 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 38)}"/>`,
        `<path d="M210 240 H734 Q834 240 864 340 Q894 440 814 500 Q784 520 734 520 H290 Q190 520 160 420 Q130 320 210 260 Z" fill="${fillRef}" ${c}/><path d="M266 286 H720 Q786 286 804 350 Q822 414 768 456 Q746 472 720 472 H322 Q256 472 238 408 Q220 344 274 302 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function minimalGeometricBadgeShape({ fillRef }) {
    return `<path d="M300 160 H724 L860 360 L724 560 H300 L164 360 Z" fill="none" stroke="${fillRef}" stroke-width="72"/>`;
}

function priceStickerShape({ fillRef, strokeWidth, variant }) {
    return priceTagShape({ fillRef, strokeWidth, variant });
}

function couponBadgeShape({ fillRef, variant }) {
    return variant === 'double'
        ? `<path d="M180 260 H844 V332 C798 332 764 366 764 412 C764 458 798 492 844 492 V564 H180 V492 C226 492 260 458 260 412 C260 366 226 332 180 332 Z" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M250 308 H774 V344 C734 352 708 378 708 412 C708 446 734 472 774 480 V516 H250 V480 C290 472 316 446 316 412 C316 378 290 352 250 344 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
        : `<path d="M180 260 H844 V332 C798 332 764 366 764 412 C764 458 798 492 844 492 V564 H180 V492 C226 492 260 458 260 412 C260 366 226 332 180 332 Z" fill="none" stroke="${fillRef}" stroke-width="68"/>`;
}

function roundedFrameLabelShape({ fillRef, variant, radius }) {
    return variant === 'outline'
        ? `<rect x="170" y="170" width="684" height="380" rx="${radius + 40}" fill="none" stroke="${fillRef}" stroke-width="68"/>`
        : `<rect x="170" y="170" width="684" height="380" rx="${radius + 40}" fill="none" stroke="${fillRef}" stroke-width="68"/><rect x="234" y="234" width="556" height="252" rx="${Math.max(0, radius + 8)}" fill="none" stroke="currentColor" stroke-width="12"/>`;
}

function premiumBadgeShape({ fillRef, strokeWidth, variant }) {
    return modernRibbonBadgeShape({ fillRef, strokeWidth, variant });
}

function circleRibbonShape({ fillRef, variant }) {
    return variant === 'double'
        ? `<circle cx="512" cy="300" r="190" fill="none" stroke="${fillRef}" stroke-width="64"/><path d="M398 460 L350 750 L512 640 L674 750 L626 460 Z" fill="none" stroke="${fillRef}" stroke-width="64"/><circle cx="512" cy="300" r="140" fill="none" stroke="currentColor" stroke-width="14"/>`
        : `<circle cx="512" cy="300" r="190" fill="none" stroke="${fillRef}" stroke-width="64"/><path d="M398 460 L350 750 L512 640 L674 750 L626 460 Z" fill="none" stroke="${fillRef}" stroke-width="64"/>`;
}

function tagLabelShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M150 240 H650 L874 360 L650 480 H150 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M150 240 H650 L874 360 L650 480 H150 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 36)}"/>`,
        `<path d="M150 240 H650 L874 360 L650 480 H150 Z" fill="${fillRef}" ${c}/><path d="M228 286 H628 L764 360 L628 434 H228 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
    );
}

function diagonalTagBannerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M170 250 L760 170 L854 310 L264 390 Z" fill="${fillRef}" ${c}/><circle cx="740" cy="204" r="24" fill="#fff" opacity="0.95"/>`,
        `<path d="M170 250 L760 170 L854 310 L264 390 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><circle cx="740" cy="204" r="18" fill="none" stroke="currentColor" stroke-width="10"/>`,
        `<path d="M170 250 L760 170 L854 310 L264 390 Z" fill="${fillRef}" ${c}/><circle cx="740" cy="204" r="24" fill="#fff" opacity="0.95"/><path d="M248 260 L720 194 L790 296 L318 362 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function saleHighlightBubbleShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<ellipse cx="470" cy="320" rx="300" ry="190" fill="${fillRef}" ${c}/><path d="M650 440 L760 590 L560 510 Z" fill="${fillRef}" ${c}/>`,
        `<ellipse cx="470" cy="320" rx="300" ry="190" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M650 440 L760 590 L560 510 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<ellipse cx="470" cy="320" rx="300" ry="190" fill="${fillRef}" ${c}/><path d="M650 440 L760 590 L560 510 Z" fill="${fillRef}" ${c}/><ellipse cx="470" cy="320" rx="246" ry="136" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function outlineRibbonBadgeShape({ fillRef, variant }) {
    return variant === 'double'
        ? `<path d="M180 270 H844 L774 360 L844 450 H180 L250 360 Z" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M280 450 L230 660 L384 520" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M744 450 L794 660 L640 520" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M260 314 H764 L722 360 L764 406 H260 L302 360 Z" fill="none" stroke="currentColor" stroke-width="14"/>`
        : `<path d="M180 270 H844 L774 360 L844 450 H180 L250 360 Z" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M280 450 L230 660 L384 520" fill="none" stroke="${fillRef}" stroke-width="68"/><path d="M744 450 L794 660 L640 520" fill="none" stroke="${fillRef}" stroke-width="68"/>`;
}

function modernPromoStickerShape({ fillRef, strokeWidth, variant }) {
    return highlightStickerShape({ fillRef, strokeWidth, variant });
}

function rectangleOutlineBannerShape({ fillRef, radius }) {
    return `<rect x="140" y="230" width="744" height="260" rx="${radius}" fill="none" stroke="${fillRef}" stroke-width="66"/>`;
}

function pillOutlineBannerShape({ fillRef }) {
    return `<rect x="120" y="240" width="784" height="240" rx="120" fill="none" stroke="${fillRef}" stroke-width="66"/>`;
}

function saleExplosionShape({ fillRef, strokeWidth, variant }) {
    return burstVariant(12, 180, 285, fillRef, strokeWidth, variant);
}

function limitedOfferBadgeShape({ fillRef, strokeWidth }) {
    return `<path d="M512 100 L650 150 L780 100 L824 240 L924 340 L824 440 L780 580 L650 530 L512 620 L374 530 L244 580 L200 440 L100 340 L200 240 L244 100 L374 150 Z" fill="${fillRef}" ${BASE_COMMON(strokeWidth)}/>`;
}

function specialDealStickerShape({ fillRef, variant }) {
    return variant === 'double'
        ? `<path d="M210 170 H770 L854 254 V550 H210 Z" fill="none" stroke="${fillRef}" stroke-width="70"/><path d="M770 170 V254 H854" fill="none" stroke="${fillRef}" stroke-width="70"/><path d="M274 234 H728 L790 296 V486 H274 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
        : `<path d="M210 170 H770 L854 254 V550 H210 Z" fill="none" stroke="${fillRef}" stroke-width="70"/><path d="M770 170 V254 H854" fill="none" stroke="${fillRef}" stroke-width="70"/>`;
}

function headlineBackgroundBarShape({ fillRef, strokeWidth, variant, radius }) {
    return roundedRectShape({ fillRef, strokeWidth, variant, radius: Math.max(radius, 18) });
}

function discountRibbonShape({ fillRef, strokeWidth, variant }) {
    return diagonalRibbonShape({ fillRef, strokeWidth, variant });
}

function couponShapeWideShape({ fillRef, strokeWidth, variant }) {
    return couponTicketShape({ fillRef, strokeWidth, variant });
}

function modernSaleTagShape({ fillRef, variant }) {
    return variant === 'double'
        ? `<path d="M160 220 H620 L864 360 L620 500 H160 Z" fill="none" stroke="${fillRef}" stroke-width="70"/><circle cx="620" cy="360" r="24" fill="${fillRef}"/><path d="M250 268 H598 L738 360 L598 452 H250 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
        : `<path d="M160 220 H620 L864 360 L620 500 H160 Z" fill="none" stroke="${fillRef}" stroke-width="70"/><circle cx="620" cy="360" r="24" fill="${fillRef}"/>`;
}

function productHighlightBarShape({ fillRef, radius }) {
    return `<rect x="130" y="260" width="764" height="200" rx="${Math.max(radius, 24)}" fill="none" stroke="${fillRef}" stroke-width="60"/>`;
}

function minimalPriceTagShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M220 210 H704 L844 360 L704 510 H220 Z" fill="${fillRef}" ${c}/><circle cx="704" cy="360" r="28" fill="#ffffff" opacity="0.92"/>`,
        `<path d="M220 210 H704 L844 360 L704 510 H220 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><circle cx="704" cy="360" r="20" fill="none" stroke="currentColor" stroke-width="10"/>`,
        `<path d="M220 210 H704 L844 360 L704 510 H220 Z" fill="${fillRef}" ${c}/><path d="M280 252 H666 L756 360 L666 468 H280 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function premiumLabelBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        burstPath(18, 198, 260, `fill="${fillRef}" ${c}`) + `<circle cx="512" cy="360" r="164" fill="${fillRef}" opacity="0.88" ${c}/>`,
        burstPath(18, 198, 260, `fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 30)}"`) + `<circle cx="512" cy="360" r="164" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 20)}"/>`,
        burstPath(18, 198, 260, `fill="${fillRef}" ${c}`) + `<circle cx="512" cy="360" r="164" fill="none" stroke="currentColor" stroke-width="14"/><path d="M328 420 H696 L636 486 H388 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function saleStickerShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<circle cx="490" cy="330" r="210" fill="${fillRef}" ${c}/><path d="M600 470 L760 620 L548 560 Z" fill="${fillRef}" ${c}/>`,
        `<circle cx="490" cy="330" r="210" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M600 470 L760 620 L548 560 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<circle cx="490" cy="330" r="210" fill="${fillRef}" ${c}/><path d="M600 470 L760 620 L548 560 Z" fill="${fillRef}" ${c}/><circle cx="490" cy="330" r="156" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function cornerBracketFrameShape({ fillRef }) {
    return `<path d="M180 220 V130 H360" fill="none" stroke="${fillRef}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M844 220 V130 H664" fill="none" stroke="${fillRef}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M180 500 V590 H360" fill="none" stroke="${fillRef}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M844 500 V590 H664" fill="none" stroke="${fillRef}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function ticketStubShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M170 250 H854 V318 C808 318 778 344 778 378 C778 412 808 438 854 438 V506 H170 V438 C216 438 246 412 246 378 C246 344 216 318 170 318 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M170 250 H854 V318 C808 318 778 344 778 378 C778 412 808 438 854 438 V506 H170 V438 C216 438 246 412 246 378 C246 344 216 318 170 318 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 32)}"/>`,
        `<path d="M170 250 H854 V318 C808 318 778 344 778 378 C778 412 808 438 854 438 V506 H170 V438 C216 438 246 412 246 378 C246 344 216 318 170 318 Z" fill="${fillRef}" ${c}/><path d="M244 286 H780 V324 C740 332 716 352 716 378 C716 404 740 424 780 432 V470 H244 V432 C284 424 308 404 308 378 C308 352 284 332 244 324 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function hangingTagShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M290 150 H734 L824 250 V570 H200 V250 Z" fill="${fillRef}" ${c}/><circle cx="512" cy="250" r="34" fill="#ffffff" opacity="0.9"/>`,
        `<path d="M290 150 H734 L824 250 V570 H200 V250 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><circle cx="512" cy="250" r="22" fill="none" stroke="currentColor" stroke-width="10"/>`,
        `<path d="M290 150 H734 L824 250 V570 H200 V250 Z" fill="${fillRef}" ${c}/><circle cx="512" cy="250" r="24" fill="none" stroke="currentColor" stroke-width="10"/><path d="M258 230 H766 V522 H258 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function diagonalPromoStripShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M180 430 L300 210 H844 L724 430 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M180 430 L300 210 H844 L724 430 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<path d="M180 430 L300 210 H844 L724 430 Z" fill="${fillRef}" ${c}/><path d="M268 394 L354 246 H756 L670 394 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function tabletHeaderStripShape({ fillRef, strokeWidth, variant, radius }) {
    return roundedRectShape({ fillRef, strokeWidth, variant, radius: Math.max(10, Math.min(radius, 56)) });
}

function sideNotchLabelShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<path d="M170 240 H810 L904 360 L810 480 H170 L230 360 Z" fill="${fillRef}" ${c}/>`,
        `<path d="M170 240 H810 L904 360 L810 480 H170 L230 360 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<path d="M170 240 H810 L904 360 L810 480 H170 L230 360 Z" fill="${fillRef}" ${c}/><path d="M252 284 H760 L824 360 L760 436 H252 L316 360 Z" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function splitPillBadgeShape({ fillRef, strokeWidth, variant }) {
    const c = BASE_COMMON(strokeWidth);
    return shapeByVariant(variant,
        `<rect x="150" y="250" width="724" height="220" rx="110" fill="${fillRef}" ${c}/><path d="M512 250 V470" fill="none" stroke="currentColor" stroke-width="18" opacity="0.45"/>`,
        `<rect x="150" y="250" width="724" height="220" rx="110" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M512 250 V470" fill="none" stroke="currentColor" stroke-width="14"/>`,
        `<rect x="150" y="250" width="724" height="220" rx="110" fill="${fillRef}" ${c}/><rect x="208" y="292" width="608" height="136" rx="68" fill="none" stroke="currentColor" stroke-width="12"/><path d="M512 292 V428" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function pointerCalloutShape({ fillRef, strokeWidth, variant, radius }) {
    const c = BASE_COMMON(strokeWidth);
    const r = Math.max(12, Math.min(radius, 56));
    return shapeByVariant(variant,
        `<rect x="170" y="180" width="684" height="300" rx="${r}" fill="${fillRef}" ${c}/><path d="M520 480 L640 620 L470 530 Z" fill="${fillRef}" ${c}/>`,
        `<rect x="170" y="180" width="684" height="300" rx="${r}" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M520 480 L640 620 L470 530 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<rect x="170" y="180" width="684" height="300" rx="${r}" fill="${fillRef}" ${c}/><path d="M520 480 L640 620 L470 530 Z" fill="${fillRef}" ${c}/><rect x="236" y="240" width="552" height="184" rx="${Math.max(0, r - 10)}" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

function bottomTabBannerShape({ fillRef, strokeWidth, variant, radius }) {
    const c = BASE_COMMON(strokeWidth);
    const r = Math.max(10, Math.min(radius, 54));
    return shapeByVariant(variant,
        `<rect x="150" y="180" width="724" height="300" rx="${r}" fill="${fillRef}" ${c}/><path d="M340 480 L420 620 L520 480 Z" fill="${fillRef}" ${c}/><path d="M504 480 L604 620 L684 480 Z" fill="${fillRef}" ${c}/>`,
        `<rect x="150" y="180" width="724" height="300" rx="${r}" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M340 480 L420 620 L520 480 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/><path d="M504 480 L604 620 L684 480 Z" fill="none" stroke="currentColor" stroke-width="${Math.max(strokeWidth, 34)}"/>`,
        `<rect x="150" y="180" width="724" height="300" rx="${r}" fill="${fillRef}" ${c}/><path d="M340 480 L420 620 L520 480 Z" fill="${fillRef}" ${c}/><path d="M504 480 L604 620 L684 480 Z" fill="${fillRef}" ${c}/><rect x="220" y="236" width="584" height="184" rx="${Math.max(0, r - 8)}" fill="none" stroke="currentColor" stroke-width="12"/>`
    );
}

// ─── Shape Catalog ───────────────────────────────────────────────

function toId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

/**
 * @type {Array<{id:string, name:string, category:string, tags:string[], variants:string[], radiusMode:string, draw:Function}>}
 */
export const SHAPES = [
    { id: 'rounded-rectangle-banner',   name: 'Rounded Rectangle Banner',   category: 'banner',  tags: ['sale','discount','price'],     variants: ['solid','outline','double'], radiusMode: 'cornerRadius', draw: roundedRectShape },
    { id: 'pill-banner',                name: 'Pill Banner',                 category: 'banner',  tags: ['sale','price'],                 variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: pillShape },
    { id: 'angled-banner',              name: 'Angled Banner',               category: 'banner',  tags: ['sale','discount'],              variants: ['solid','outline'],          radiusMode: 'none',         draw: angledBannerShape },
    { id: 'diagonal-ribbon',            name: 'Diagonal Ribbon',             category: 'ribbon',  tags: ['discount','sale'],              variants: ['solid','outline'],          radiusMode: 'none',         draw: diagonalRibbonShape },
    { id: 'double-ribbon',              name: 'Double Ribbon',               category: 'ribbon',  tags: ['discount','premium'],           variants: ['double','solid'],           radiusMode: 'none',         draw: doubleRibbonShape },
    { id: 'flag-ribbon',                name: 'Flag Ribbon',                 category: 'ribbon',  tags: ['sale','food'],                  variants: ['solid','outline'],          radiusMode: 'none',         draw: angledBannerShape },
    { id: 'circle-badge',               name: 'Circle Badge',                category: 'badge',   tags: ['sale','premium'],               variants: ['solid','outline'],          radiusMode: 'none',         draw: circleBadgeShape },
    { id: 'circle-outline-badge',       name: 'Circle Outline Badge',        category: 'badge',   tags: ['premium','sale'],               variants: ['outline'],                  radiusMode: 'none',         draw: circleOutlineBadgeShape },
    { id: 'oval-badge',                 name: 'Oval Badge',                  category: 'badge',   tags: ['sale','discount'],              variants: ['solid','outline'],          radiusMode: 'none',         draw: ovalBadgeShape },
    { id: 'rounded-square-badge',       name: 'Rounded Square Badge',        category: 'badge',   tags: ['price','sale'],                 variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: roundedSquareShape },
    { id: 'starburst-badge',            name: 'Starburst Badge',             category: 'badge',   tags: ['discount','sale'],              variants: ['solid','outline'],          radiusMode: 'none',         draw: starburstShape },
    { id: 'burst-explosion-shape',      name: 'Burst Explosion Shape',       category: 'badge',   tags: ['sale','discount'],              variants: ['solid'],                    radiusMode: 'none',         draw: burstExplosionShape },
    { id: 'price-tag-shape',            name: 'Price Tag Shape',             category: 'tag',     tags: ['price','discount'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: priceTagShape },
    { id: 'coupon-ticket-shape',        name: 'Coupon Ticket Shape',         category: 'tag',     tags: ['discount','price'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: couponTicketShape },
    { id: 'corner-ribbon',              name: 'Corner Ribbon',               category: 'ribbon',  tags: ['sale','discount'],              variants: ['solid'],                    radiusMode: 'none',         draw: cornerRibbonShape },
    { id: 'corner-sticker',             name: 'Corner Sticker',              category: 'sticker', tags: ['sale','discount'],              variants: ['solid','double'],           radiusMode: 'none',         draw: cornerStickerShape },
    { id: 'sale-badge-shape',           name: 'Sale Badge Shape',            category: 'badge',   tags: ['sale','discount'],              variants: ['solid'],                    radiusMode: 'none',         draw: saleBadgeShape },
    { id: 'speech-bubble',              name: 'Speech Bubble',               category: 'sticker', tags: ['food','price'],                 variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: speechBubbleShape },
    { id: 'minimal-badge',              name: 'Minimal Badge',               category: 'badge',   tags: ['premium','price'],              variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: minimalBadgeShape },
    { id: 'product-highlight-frame',    name: 'Product Highlight Frame',     category: 'frame',   tags: ['food','price'],                 variants: ['outline','double'],         radiusMode: 'cornerRadius', draw: productHighlightFrameShape },
    { id: 'price-highlight-box',        name: 'Price Highlight Box',         category: 'frame',   tags: ['price','discount'],             variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: priceHighlightBoxShape },
    { id: 'angled-rectangle-banner',    name: 'Angled Rectangle Banner',     category: 'banner',  tags: ['sale','food'],                  variants: ['solid','outline'],          radiusMode: 'none',         draw: angledBannerShape },
    { id: 'modern-geometric-badge',     name: 'Modern Geometric Badge',      category: 'badge',   tags: ['premium'],                      variants: ['solid','outline'],          radiusMode: 'none',         draw: modernGeometricBadgeShape },
    { id: 'highlight-sticker',          name: 'Highlight Sticker',           category: 'sticker', tags: ['discount','price'],             variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: highlightStickerShape },
    { id: 'diamond-badge',              name: 'Diamond Badge',               category: 'badge',   tags: ['premium'],                      variants: ['solid','outline'],          radiusMode: 'none',         draw: diamondBadgeShape },
    { id: 'hexagon-badge',              name: 'Hexagon Badge',               category: 'badge',   tags: ['premium','sale'],               variants: ['solid','outline'],          radiusMode: 'none',         draw: hexagonBadgeShape },
    { id: 'octagon-badge',              name: 'Octagon Badge',               category: 'badge',   tags: ['premium','sale'],               variants: ['solid','outline'],          radiusMode: 'none',         draw: octagonBadgeShape },
    { id: 'triangle-banner',            name: 'Triangle Banner',             category: 'banner',  tags: ['sale'],                         variants: ['solid','outline'],          radiusMode: 'none',         draw: triangleBannerShape },
    { id: 'shield-badge',               name: 'Shield Badge',                category: 'badge',   tags: ['premium'],                      variants: ['solid','outline'],          radiusMode: 'none',         draw: shieldBadgeShape },
    { id: 'ticket-label',               name: 'Ticket Label',                category: 'tag',     tags: ['price','discount'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: couponTicketShape },
    { id: 'folded-corner-banner',       name: 'Folded Corner Banner',        category: 'banner',  tags: ['sale','discount'],              variants: ['solid','double'],           radiusMode: 'cornerRadius', draw: highlightStickerShape },
    { id: 'modern-ribbon-badge',        name: 'Modern Ribbon Badge',         category: 'ribbon',  tags: ['premium','sale'],               variants: ['solid','double'],           radiusMode: 'none',         draw: modernRibbonBadgeShape },
    { id: 'double-flag-banner',         name: 'Double Flag Banner',          category: 'banner',  tags: ['sale','food'],                  variants: ['double'],                   radiusMode: 'none',         draw: doubleFlagBannerShape },
    { id: 'product-spotlight-frame',    name: 'Product Spotlight Frame',     category: 'frame',   tags: ['food','price'],                 variants: ['outline','double'],         radiusMode: 'cornerRadius', draw: productHighlightFrameShape },
    { id: 'corner-frame-highlight',     name: 'Corner Frame Highlight',      category: 'frame',   tags: ['food','price'],                 variants: ['outline'],                  radiusMode: 'cornerRadius', draw: cornerFrameHighlightShape },
    { id: 'sale-burst-circle',          name: 'Sale Burst Circle',           category: 'badge',   tags: ['sale','discount'],              variants: ['solid'],                    radiusMode: 'none',         draw: saleBurstCircleShape },
    { id: 'star-badge',                 name: 'Star Badge',                  category: 'badge',   tags: ['premium'],                      variants: ['solid','outline'],          radiusMode: 'none',         draw: starBadgeShape },
    { id: 'angled-pill-banner',         name: 'Angled Pill Banner',          category: 'banner',  tags: ['sale','price'],                 variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: angledPillBannerShape },
    { id: 'minimal-geometric-badge',    name: 'Minimal Geometric Badge',     category: 'badge',   tags: ['premium'],                      variants: ['outline'],                  radiusMode: 'none',         draw: minimalGeometricBadgeShape },
    { id: 'price-sticker-shape',        name: 'Price Sticker Shape',         category: 'sticker', tags: ['price','discount'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: priceTagShape },
    { id: 'coupon-badge',               name: 'Coupon Badge',                category: 'badge',   tags: ['discount','price'],             variants: ['outline','double'],         radiusMode: 'none',         draw: couponBadgeShape },
    { id: 'rounded-frame-label',        name: 'Rounded Frame Label',         category: 'frame',   tags: ['price','food'],                 variants: ['outline'],                  radiusMode: 'cornerRadius', draw: roundedFrameLabelShape },
    { id: 'premium-badge',              name: 'Premium Badge',               category: 'badge',   tags: ['premium'],                      variants: ['solid','double'],           radiusMode: 'none',         draw: modernRibbonBadgeShape },
    { id: 'circle-ribbon',              name: 'Circle Ribbon',               category: 'ribbon',  tags: ['premium'],                      variants: ['outline','double'],         radiusMode: 'none',         draw: circleRibbonShape },
    { id: 'tag-label-shape',            name: 'Tag Label Shape',             category: 'tag',     tags: ['price','food'],                 variants: ['solid','outline'],          radiusMode: 'none',         draw: tagLabelShape },
    { id: 'diagonal-tag-banner',        name: 'Diagonal Tag Banner',         category: 'tag',     tags: ['discount','price'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: diagonalTagBannerShape },
    { id: 'sale-highlight-bubble',      name: 'Sale Highlight Bubble',       category: 'sticker', tags: ['sale','food'],                  variants: ['solid'],                    radiusMode: 'cornerRadius', draw: saleHighlightBubbleShape },
    { id: 'outline-ribbon-badge',       name: 'Outline Ribbon Badge',        category: 'ribbon',  tags: ['premium','discount'],           variants: ['outline','double'],         radiusMode: 'none',         draw: outlineRibbonBadgeShape },
    { id: 'modern-promo-sticker',       name: 'Modern Promo Sticker',        category: 'sticker', tags: ['discount','sale'],              variants: ['solid','double'],           radiusMode: 'cornerRadius', draw: highlightStickerShape },
    { id: 'rectangle-outline-banner',   name: 'Rectangle Outline Banner',    category: 'banner',  tags: ['price','discount'],             variants: ['outline'],                  radiusMode: 'cornerRadius', draw: rectangleOutlineBannerShape },
    { id: 'pill-outline-banner',        name: 'Pill Outline Banner',         category: 'banner',  tags: ['price','sale'],                 variants: ['outline'],                  radiusMode: 'cornerRadius', draw: pillOutlineBannerShape },
    { id: 'sale-explosion-shape',       name: 'Sale Explosion Shape',        category: 'badge',   tags: ['sale','discount'],              variants: ['solid'],                    radiusMode: 'none',         draw: saleExplosionShape },
    { id: 'limited-offer-badge',        name: 'Limited Offer Badge',         category: 'badge',   tags: ['sale','premium'],               variants: ['solid'],                    radiusMode: 'none',         draw: limitedOfferBadgeShape },
    { id: 'special-deal-sticker',       name: 'Special Deal Sticker',        category: 'sticker', tags: ['discount','price'],             variants: ['outline','double'],         radiusMode: 'cornerRadius', draw: specialDealStickerShape },
    { id: 'headline-background-bar',    name: 'Headline Background Bar',     category: 'banner',  tags: ['price','food'],                 variants: ['solid','outline'],          radiusMode: 'cornerRadius', draw: headlineBackgroundBarShape },
    { id: 'discount-ribbon',            name: 'Discount Ribbon',             category: 'ribbon',  tags: ['discount','sale'],              variants: ['solid','outline'],          radiusMode: 'none',         draw: diagonalRibbonShape },
    { id: 'coupon-shape-wide',          name: 'Coupon Shape Wide',           category: 'tag',     tags: ['discount','price'],             variants: ['solid','outline'],          radiusMode: 'none',         draw: couponTicketShape },
    { id: 'modern-sale-tag',            name: 'Modern Sale Tag',             category: 'tag',     tags: ['sale','price'],                 variants: ['outline','double'],         radiusMode: 'none',         draw: modernSaleTagShape },
    { id: 'product-highlight-bar',      name: 'Product Highlight Bar',       category: 'frame',   tags: ['food','price'],                 variants: ['outline'],                  radiusMode: 'cornerRadius', draw: productHighlightBarShape },
    { id: 'minimal-price-tag',          name: 'Minimal Price Tag',           category: 'tag',     tags: ['price','discount'],             variants: ['solid','outline','double'], radiusMode: 'none',         draw: minimalPriceTagShape },
    { id: 'premium-label-badge',        name: 'Premium Label Badge',         category: 'badge',   tags: ['premium','sale'],               variants: ['solid','outline','double'], radiusMode: 'none',         draw: premiumLabelBadgeShape },
    { id: 'sale-sticker',               name: 'Sale Sticker',                category: 'sticker', tags: ['sale','discount'],              variants: ['solid','outline','double'], radiusMode: 'cornerRadius', draw: saleStickerShape },
    { id: 'corner-bracket-frame',       name: 'Corner Bracket Frame',        category: 'frame',   tags: ['highlight','product'],          variants: ['outline'],                  radiusMode: 'none',         draw: cornerBracketFrameShape },
    { id: 'ticket-stub-shape',          name: 'Ticket Stub Shape',           category: 'tag',     tags: ['ticket','coupon','price'],      variants: ['solid','outline','double'], radiusMode: 'none',         draw: ticketStubShape },
    { id: 'hanging-tag',                name: 'Hanging Tag',                 category: 'tag',     tags: ['tag','price','label'],          variants: ['solid','outline','double'], radiusMode: 'none',         draw: hangingTagShape },
    { id: 'diagonal-promo-strip',       name: 'Diagonal Promo Strip',        category: 'banner',  tags: ['promo','discount','sale'],      variants: ['solid','outline','double'], radiusMode: 'none',         draw: diagonalPromoStripShape },
    { id: 'tablet-header-strip',        name: 'Tablet Header Strip',         category: 'banner',  tags: ['header','tablet','highlight'],  variants: ['solid','outline','double'], radiusMode: 'cornerRadius', draw: tabletHeaderStripShape },
    { id: 'side-notch-label',           name: 'Side Notch Label',            category: 'tag',     tags: ['label','price','tablet'],       variants: ['solid','outline','double'], radiusMode: 'none',         draw: sideNotchLabelShape },
    { id: 'split-pill-badge',           name: 'Split Pill Badge',            category: 'badge',   tags: ['badge','price','modern'],       variants: ['solid','outline','double'], radiusMode: 'none',         draw: splitPillBadgeShape },
    { id: 'pointer-callout',            name: 'Pointer Callout',             category: 'sticker', tags: ['callout','promo','tablet'],     variants: ['solid','outline','double'], radiusMode: 'cornerRadius', draw: pointerCalloutShape },
    { id: 'bottom-tab-banner',          name: 'Bottom Tab Banner',           category: 'banner',  tags: ['banner','promo','header'],      variants: ['solid','outline','double'], radiusMode: 'cornerRadius', draw: bottomTabBannerShape },
];

/** New/featured shapes for quick filtering */
export const NEW_SHAPE_IDS = [
    'minimal-price-tag',
    'premium-label-badge',
    'sale-sticker',
    'corner-bracket-frame',
    'ticket-stub-shape',
    'hanging-tag',
    'diagonal-promo-strip',
    'tablet-header-strip',
    'side-notch-label',
    'split-pill-badge',
    'pointer-callout',
    'bottom-tab-banner'
];

/** All distinct categories */
export const CATEGORIES = [...new Set(SHAPES.map(s => s.category))];

/** SVG viewBox for all shapes */
export const SHAPE_VIEWBOX = '0 0 1024 720';

// ─── query helpers ───────────────────────────────────────────────

export function getShapeById(id) {
    return SHAPES.find(s => s.id === id) || null;
}

export function getShapesByCategory(category) {
    if (!category || category === 'all') return SHAPES;
    if (category === 'new') return SHAPES.filter(s => NEW_SHAPE_IDS.includes(s.id));
    return SHAPES.filter(s => s.category === category);
}

export function searchShapes(query) {
    if (!query) return SHAPES;
    const q = query.toLowerCase();
    return SHAPES.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.includes(q) ||
        s.tags.some(t => t.includes(q))
    );
}

/**
 * Render a shape preview as an SVG string.
 * @param {object} shapeDef - Shape definition from SHAPES array
 * @param {object} opts - { fill, stroke, strokeWidth, variant, radius, width, height }
 * @returns {string} Complete SVG markup
 */
export function renderShapeSvg(shapeDef, opts = {}) {
    const {
        fill = '#ff4d4f',
        stroke = '#1f2937',
        strokeWidth = 8,
        variant = shapeDef.variants[0],
        radius = 24,
        width = 120,
        height = 84
    } = opts;

    const inner = shapeDef.draw({ fillRef: fill, strokeWidth, variant, radius });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SHAPE_VIEWBOX}" width="${width}" height="${height}" style="color:${stroke}">${inner}</svg>`;
}
