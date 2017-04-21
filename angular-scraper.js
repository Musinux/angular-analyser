#!/usr/bin/env node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const jsdom = require('jsdom')
const path = require('path')
const debug = require('debug')('scraper:debug')
const debugOutput = console.log
const fs = require('fs')
const argv = require('yargs')
  .usage('Usage: $0 <url>')
  .demandCommand(1)
  .argv

let info
if (argv.v) {
  info = console.log
} else {
  info = function () {}
}

// load scripts used to inspect the target application
const jquery = fs.readFileSync(path.join(__dirname, 'node_modules/jquery/dist/jquery.js'), 'utf-8')
const inspect = fs.readFileSync(path.join(__dirname, 'inspect.js'), 'utf-8')
// get url of target
const url = argv._[0]

// output container execution console to main console
const specialConsole = {
  log: debugOutput,
  error: debug,
  warn: debug
}

let scripts = []
let scriptsContent = {}
/*
  Here we gather all scripts bodies to pass them to the inspector
    => we can do both static and dynamic analysis
   */
function fetchScript (script) {
  return new Promise((resolve, reject) => {
    script.resource.defaultFetch((err, body) => {
      if (err) return script.cb(err)
      scriptsContent[script.resource.url.href] = body
      resolve()
    })
  })
}
/*
  In order to load our inspection scripts **before** page load
  and **after** other scripts retrieval (load order is important)
  we get all resources targets with resourceLoader, keep them in 'script'

  We wait until all scripts are registered in 'scripts',
  and then we get them normally.
  The only difference is for the last script' load, where we append
  jquery and inspect to it in order to load them last but before
  first angular round of html parsing
   */

function startFetchingScripts () {
  setTimeout(function () {
    info('Fetching external scripts...')

    if (!scripts.length) {
      info('Waiting for scripts...')
      startFetchingScripts()
      return
    }
    let promises = []
    for (var i = 0; i < scripts.length; i++) {
      info('Fetch', scripts[i].resource.url.href)
      promises.push(fetchScript(scripts[i]))
    }

    Promise.all(promises)
    .then(() => {
      // load our special scripts after last script fetch
      startLoadingScripts(scripts, scriptsContent)
    })
  }, 2000)
}

function startLoadingScripts (scripts, content) {
  info('Loading external scripts...')
  for (let i = 0; i < scripts.length - 1; i++) {
    info('Load', scripts[i].resource.url.href, '...')
    scripts[i].cb(null, content[scripts[i].resource.url.href])
  } 
  let last = scripts[scripts.length - 1]
  console.log('
  last.cb(null, content[last.resource.url.href] + '\n' +
    'function loadjQueryAngularScraper() {' + jquery + '}\n' +
    ';window.angularScraperScripts = ' + JSON.stringify(content) + ';' + inspect)
}

startFetchingScripts()

/*
  We start the fake DOM environment for the angular App
  To know what are the processings to the angular App, look at inspect.js
   */
info('Loading environment...')

jsdom.env({
  url: url,
  resourceLoader: (resource, cb) => scripts.push({resource, cb}),
  done: (err, window) => {
    if (err) throw err
    info('[-] Page loaded')
  },
  virtualConsole: jsdom.createVirtualConsole().sendTo(specialConsole),
  features: {
    FetchExternalResources: ['script'],
    ProcessExternalResources: ['script']
  }
})
