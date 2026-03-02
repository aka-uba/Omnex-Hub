/**
 * VvvebJs English Language Pack
 * English is the default language - this file ensures consistency
 */

(function() {
    'use strict';

    // English translations (original texts - for reference and consistency)
    const translations = {
        // Panel headers
        'Components': 'Components',
        'Sections': 'Sections',
        'Blocks': 'Blocks',
        'Styling': 'Styling',
        'Properties': 'Properties',
        'Pages': 'Pages',
        'Layers': 'Layers',
        'File Manager': 'File Manager',

        // Component groups
        'Omnex': 'Omnex Widgets',
        'Bootstrap': 'Bootstrap',
        'HTML': 'HTML',
        'Basic': 'Basic',
        'Elements': 'Elements',
        'Typography': 'Typography',
        'Layout': 'Layout',
        'Content': 'Content',
        'Media': 'Media',
        'Form': 'Form',
        'Widgets': 'Widgets',
        'Embeds': 'Embeds',
        'Landing': 'Landing Page',
        'Common': 'Common',

        // Component names
        'Text': 'Text',
        'Button': 'Button',
        'Image': 'Image',
        'Video': 'Video',
        'Link': 'Link',
        'Heading': 'Heading',
        'Paragraph': 'Paragraph',
        'Container': 'Container',
        'Row': 'Row',
        'Column': 'Column',
        'Section': 'Section',
        'Card': 'Card',
        'Table': 'Table',
        'Alert': 'Alert',
        'Badge': 'Badge',
        'Progress': 'Progress',
        'Carousel': 'Carousel',
        'Tabs': 'Tabs',
        'Accordion': 'Accordion',
        'Modal': 'Modal',
        'Navbar': 'Navbar',
        'Nav': 'Nav',
        'Footer': 'Footer',
        'Header': 'Header',
        'Input': 'Input',
        'Select': 'Select',
        'Checkbox': 'Checkbox',
        'Radio': 'Radio',
        'Textarea': 'Textarea',
        'List': 'List',
        'Divider': 'Divider',
        'Blockquote': 'Blockquote',
        'Code': 'Code',
        'Embed': 'Embed',
        'Map': 'Map',
        'Icon': 'Icon',
        'Social Icons': 'Social Icons',
        'Youtube': 'Youtube',
        'Google Map': 'Google Map',
        'Slider': 'Slider',
        'Gallery': 'Gallery',
        'Pricing': 'Pricing',
        'Testimonial': 'Testimonial',
        'Team': 'Team',
        'Features': 'Features',
        'Services': 'Services',
        'About': 'About',
        'Contact': 'Contact',
        'Call to action': 'Call to action',
        'Hero': 'Hero Section',
        'Countdown': 'Countdown',
        'Subscribe': 'Subscribe',
        'Newsletter': 'Newsletter',
        'Search': 'Search',
        'Menu': 'Menu',
        'Logo': 'Logo',
        'Breadcrumbs': 'Breadcrumbs',
        'Pagination': 'Pagination',

        // Omnex components
        'Product Card': 'Product Card',
        'Price List': 'Price List',
        'Ticker': 'Ticker',
        'Clock': 'Clock',
        'QR Code': 'QR Code',
        'Media Image': 'Media Image',
        'Dynamic Text': 'Dynamic Text',

        // Toolbar buttons
        'Undo': 'Undo',
        'Redo': 'Redo',
        'Preview': 'Preview',
        'Download': 'Download',
        'Save': 'Save',
        'Export': 'Export',
        'Import': 'Import',
        'Clear': 'Clear',
        'Fullscreen': 'Fullscreen',
        'Code editor': 'Code editor',
        'Device': 'Device',
        'Desktop': 'Desktop',
        'Tablet': 'Tablet',
        'Mobile': 'Mobile',

        // Properties panel
        'ID': 'ID',
        'Class': 'Class',
        'Style': 'Style',
        'Name': 'Name',
        'Value': 'Value',
        'Placeholder': 'Placeholder',
        'Title': 'Title',
        'Alt': 'Alt Text',
        'Href': 'Link',
        'Target': 'Target',
        'Type': 'Type',
        'Action': 'Action',
        'Method': 'Method',
        'Width': 'Width',
        'Height': 'Height',
        'Margin': 'Margin',
        'Padding': 'Padding',
        'Border': 'Border',
        'Background': 'Background',
        'Color': 'Color',
        'Font': 'Font',
        'Font Size': 'Font Size',
        'Font Weight': 'Font Weight',
        'Text Align': 'Text Align',
        'Line Height': 'Line Height',
        'Letter Spacing': 'Letter Spacing',
        'Text Transform': 'Text Transform',
        'Text Decoration': 'Text Decoration',
        'Display': 'Display',
        'Position': 'Position',
        'Flex': 'Flex',
        'Grid': 'Grid',
        'Opacity': 'Opacity',
        'Visibility': 'Visibility',
        'Overflow': 'Overflow',
        'Z-Index': 'Z-Index',
        'Transform': 'Transform',
        'Transition': 'Transition',
        'Animation': 'Animation',
        'Filter': 'Filter',
        'Shadow': 'Shadow',
        'Radius': 'Radius',
        'None': 'None',
        'Auto': 'Auto',
        'Inherit': 'Inherit',
        'Initial': 'Initial',

        // Text alignment
        'Left': 'Left',
        'Center': 'Center',
        'Right': 'Right',
        'Justify': 'Justify',

        // Font weights
        'Normal': 'Normal',
        'Bold': 'Bold',
        'Light': 'Light',
        'Thin': 'Thin',
        'Medium': 'Medium',
        'Semibold': 'Semibold',
        'Black': 'Black',

        // Display values
        'Block': 'Block',
        'Inline': 'Inline',
        'Inline Block': 'Inline Block',
        'Hidden': 'Hidden',

        // Position values
        'Static': 'Static',
        'Relative': 'Relative',
        'Absolute': 'Absolute',
        'Fixed': 'Fixed',
        'Sticky': 'Sticky',

        // Colors
        'Primary': 'Primary',
        'Secondary': 'Secondary',
        'Success': 'Success',
        'Danger': 'Danger',
        'Warning': 'Warning',
        'Info': 'Info',
        'Dark': 'Dark',
        'White': 'White',
        'Transparent': 'Transparent',

        // Sizes
        'Small': 'Small',
        'Large': 'Large',
        'Extra Small': 'Extra Small',
        'Extra Large': 'Extra Large',

        // Actions
        'Add': 'Add',
        'Edit': 'Edit',
        'Delete': 'Delete',
        'Remove': 'Remove',
        'Copy': 'Copy',
        'Paste': 'Paste',
        'Cut': 'Cut',
        'Duplicate': 'Duplicate',
        'Move Up': 'Move Up',
        'Move Down': 'Move Down',
        'Select': 'Select',
        'Cancel': 'Cancel',
        'Close': 'Close',
        'OK': 'OK',
        'Apply': 'Apply',
        'Reset': 'Reset',
        'Browse': 'Browse',
        'Upload': 'Upload',
        'Load': 'Load',
        'Refresh': 'Refresh',

        // Messages
        'Loading...': 'Loading...',
        'Saving...': 'Saving...',
        'Saved': 'Saved',
        'Error': 'Error',
        'Are you sure?': 'Are you sure?',
        'Confirm': 'Confirm',
        'No results found': 'No results found',
        'Drop files here': 'Drop files here',
        'or click to browse': 'or click to browse',
        'File uploaded': 'File uploaded',
        'Upload failed': 'Upload failed',
        'Page saved': 'Page saved',
        'Page exported': 'Page exported',

        // Media modal
        'Media Library': 'Media Library',
        'Upload file': 'Upload file',
        'Drop or choose files to upload': 'Drop or choose files to upload',
        'Find a file..': 'Find a file..',
        'No files here.': 'No files here.',
        'Add selected': 'Add selected',

        // Page management
        'New page': 'New page',
        'Rename': 'Rename',
        'Page name': 'Page name',
        'Page url': 'Page URL',

        // AI Assistant
        'AI Assistant': 'AI Assistant',
        'Ask AI': 'Ask AI',
        'Generate': 'Generate',
        'Generating...': 'Generating...',

        // Responsive
        'Responsive': 'Responsive',
        'Show on all devices': 'Show on all devices',
        'Hide on mobile': 'Hide on mobile',
        'Hide on tablet': 'Hide on tablet',
        'Hide on desktop': 'Hide on desktop',

        // Other
        'Default': 'Default',
        'Custom': 'Custom',
        'Advanced': 'Advanced',
        'General': 'General',
        'Options': 'Options',
        'Settings': 'Settings',
        'Appearance': 'Appearance',
        'Spacing': 'Spacing',
        'Size': 'Size',
        'Effects': 'Effects',
        'Extra': 'Extra',
        'Attributes': 'Attributes',
        'Events': 'Events',
        'Data': 'Data'
    };

    // Register translations with i18n system
    if (window.VvvebI18n) {
        window.VvvebI18n.registerTranslations('en', translations);
    }

    // Only apply translations if English is the current locale
    // English is the default, so no DOM manipulation needed

    // Expose translations for external use
    window.VvvebTranslationsEN = translations;

    console.log('VvvebJs English language pack loaded');

})();
