#!/usr/bin/env node
/**
 * generate-og-image.js — Genera imagen de Open Graph para Twitter Cards
 * 
 * Requiere: npm install canvas
 * Uso: node generate-og-image.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background gradient
const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
gradient.addColorStop(0, '#0f172a');
gradient.addColorStop(1, '#1e293b');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Grid pattern (subtle)
ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
ctx.lineWidth = 1;
for (let i = 0; i < WIDTH; i += 40) {
  ctx.beginPath();
  ctx.moveTo(i, 0);
  ctx.lineTo(i, HEIGHT);
  ctx.stroke();
}
for (let i = 0; i < HEIGHT; i += 40) {
  ctx.beginPath();
  ctx.moveTo(0, i);
  ctx.lineTo(WIDTH, i);
  ctx.stroke();
}

// Logo/Icon (simple geometric circles)
ctx.fillStyle = '#3b82f6';
ctx.beginPath();
ctx.arc(150, 315, 60, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = '#60a5fa';
ctx.beginPath();
ctx.arc(180, 285, 40, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = '#93c5fd';
ctx.beginPath();
ctx.arc(180, 345, 30, 0, Math.PI * 2);
ctx.fill();

// Main title
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 72px Arial, sans-serif';
ctx.fillText('ReliableAI', 280, 280);

// Subtitle
ctx.fillStyle = '#94a3b8';
ctx.font = '32px Arial, sans-serif';
ctx.fillText('Multi-Model AI Research Platform', 280, 340);

// Features
ctx.fillStyle = '#64748b';
ctx.font = '24px Arial, sans-serif';
ctx.fillText('Claude • GPT • Gemini • Grok • Qwen • GLM', 280, 400);

// Accent line
ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(280, 420);
ctx.lineTo(580, 420);
ctx.stroke();

// Bottom tagline
ctx.fillStyle = '#475569';
ctx.font = '20px Arial, sans-serif';
ctx.fillText('Cross-verify answers • Detect contradictions • Get reliable synthesis', 280, 460);

// Save
const buffer = canvas.toBuffer('image/png');
const outputPath = path.join(__dirname, 'public', 'og-image.png');
fs.writeFileSync(outputPath, buffer);

console.log('✅ OG image generated:', outputPath);
console.log('📏 Size: 1200x630px');
console.log('📦 File size:', (buffer.length / 1024).toFixed(2), 'KB');
