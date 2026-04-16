#!/usr/bin/env node
/**
 * Scheduler automático para bot de engagement
 * Ejecuta 3 veces al día: 9am, 2pm, 8pm EST
 */

const cron = require('node-cron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'scheduler.log');
const ENGAGEMENT_SCRIPT = path.join(__dirname, 'engagement-hybrid.js');

// Horarios en EST (UTC-5)
// 9:00 AM EST = 14:00 UTC
// 2:00 PM EST = 19:00 UTC
// 8:00 PM EST = 01:00 UTC (día siguiente)

const SCHEDULES = [
  { time: '0 14 * * *', name: 'Morning (9am EST)', timezone: 'America/New_York' },
  { time: '0 19 * * *', name: 'Afternoon (2pm EST)', timezone: 'America/New_York' },
  { time: '0 1 * * *', name: 'Evening (8pm EST)', timezone: 'America/New_York' }
];

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

function runEngagementBot() {
  return new Promise((resolve, reject) => {
    log('🤖 Iniciando bot de engagement...');
    
    const child = spawn('node', [ENGAGEMENT_SCRIPT], {
      stdio: 'pipe',
      cwd: __dirname
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ Bot completado exitosamente`);
        
        // Extraer métricas del output
        const publishedMatch = output.match(/Published: (\d+)/);
        if (publishedMatch) {
          log(`📊 Respuestas publicadas: ${publishedMatch[1]}`);
        }
        
        resolve({ success: true, output });
      } else {
        log(`❌ Bot falló con código: ${code}`);
        log(`Error: ${errorOutput}`);
        reject(new Error(`Exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      log(`❌ Error al ejecutar bot: ${error.message}`);
      reject(error);
    });
  });
}

async function scheduledRun(scheduleName) {
  log('╔═══════════════════════════════════════════════════════════════╗');
  log(`║  🕐 Ejecución Programada: ${scheduleName.padEnd(42)} ║`);
  log('╚═══════════════════════════════════════════════════════════════╝');
  
  try {
    await runEngagementBot();
    log('✅ Ejecución completada\n');
  } catch (error) {
    log(`❌ Ejecución falló: ${error.message}\n`);
  }
}

function startScheduler() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📅 Twitter Engagement Scheduler                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  log('🚀 Scheduler iniciado');
  log(`📝 Log file: ${LOG_FILE}`);
  log(`🤖 Script: ${ENGAGEMENT_SCRIPT}\n`);
  
  console.log('📋 Horarios configurados (EST):\n');
  
  SCHEDULES.forEach((schedule, index) => {
    console.log(`   ${index + 1}. ${schedule.name}`);
    console.log(`      Cron: ${schedule.time}`);
    console.log(`      Timezone: ${schedule.timezone}\n`);
    
    cron.schedule(schedule.time, () => {
      scheduledRun(schedule.name);
    }, {
      timezone: schedule.timezone
    });
    
    log(`✅ Programado: ${schedule.name} (${schedule.time})`);
  });
  
  console.log('✅ Scheduler activo. Presiona Ctrl+C para detener.\n');
  console.log('📊 Próximas ejecuciones:');
  
  // Calcular próximas ejecuciones
  const now = new Date();
  const nextRuns = SCHEDULES.map(schedule => {
    const [minute, hour] = schedule.time.split(' ').slice(0, 2);
    const next = new Date(now);
    next.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return {
      name: schedule.name,
      time: next.toLocaleString('es-ES', { 
        timeZone: 'America/New_York',
        dateStyle: 'short',
        timeStyle: 'short'
      })
    };
  }).sort((a, b) => new Date(a.time) - new Date(b.time));
  
  nextRuns.forEach((run, index) => {
    console.log(`   ${index + 1}. ${run.name}: ${run.time}`);
  });
  
  console.log('\n');
}

// Manejo de señales para shutdown graceful
process.on('SIGINT', () => {
  log('\n⚠️  Recibida señal SIGINT. Deteniendo scheduler...');
  log('👋 Scheduler detenido\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n⚠️  Recibida señal SIGTERM. Deteniendo scheduler...');
  log('👋 Scheduler detenido\n');
  process.exit(0);
});

// Iniciar scheduler
startScheduler();
