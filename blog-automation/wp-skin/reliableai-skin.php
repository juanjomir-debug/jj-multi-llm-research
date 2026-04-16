<?php
/**
 * Plugin Name: ReliableAI Theme Skin
 * Description: Dark theme matching reliableai.net design system
 * Version: 1.0.4
 */
if (!defined('ABSPATH')) exit;

add_action('wp_enqueue_scripts', function() {
    wp_enqueue_style(
        'reliableai-skin',
        plugin_dir_url(__FILE__) . 'reliableai-skin.css',
        [],
        '1.0.4'
    );
});
