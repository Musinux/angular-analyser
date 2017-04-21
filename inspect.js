/* global loadjQueryAngularScraper */
console.log('*** INSPECT.JS ***')
var angular = window.angular || document.angular
var $ = window.$ || window.jQuery

console.log('[+] Static Analysis')

/**
  Here we try to check angular version just by looking at the AngularJS string
  **/
function angularVersion (scripts) {
  var version = angular && angular.version && angular.version.full || null
  var isAngular = angular || false
  if (version) return version
  var pattern = /ngular/gi
  var names = Object.keys(scripts)
  for (var i = 0; i < names.length; i++) {
    var script = scripts[names[i]]
    var test = script.match(/[0-9]{1,}(\.[0-9]{1,2})+/)
    if (script.match(/AngularJS v[0-9]{1,}(\.[0-9]{1,2})+/)) {
      version = script.match(/AngularJS v[0-9]{1,}(\.[0-9]{1,2})+/)[0]
        .match(/[0-9]{1,}(\.[0-9]{1,2})+/g)
    }
    if (script.match(pattern) && !isAngular) {
      isAngular = true
    }
    if (isAngular && test) {
      console.log('test', test[0], script.slice(test.index - 10, test.index + 10))
      version = test[0] + ' (guess)'
    }
  }
  return version || isAngular
}

var scripts = window.angularScraperScripts
console.log('[-] external scripts: (', Object.keys(scripts).length, ')', Object.keys(scripts))
var version = angularVersion(scripts)
console.log('[-] AngularJS:', !!version)
console.log('[-] AngularJS version:', version)

function findString (scripts, find) {
  var where = []
  var names = Object.keys(scripts)
  for (var i = 0; i < names.length; i++) {
    var script = scripts[names[i]]
    var index = script.indexOf(find)
    if (index >= 0) {
      where.push({
        name: names[i],
        index: index,
        line: script.slice(0, index).split('\n').length
      })
    }
  }
  return where
}

console.log('[+] Dynamic Analysis')

// Add JQuery if not present to help manipulate DOM
if (!window.jQuery) {
  loadjQueryAngularScraper()
  if (window.jQuery || window.$) {
    console.log('[-] JQuery loaded')
  } else {
    console.error('[Error] Could not load JQuery')
  }
  $ = window.$ || window.jQuery
}

var i = 0
var silentRequests = true
var apps = $('[ng-app]')
console.log('[><] ', apps.scope())
console.log('[-] Found', apps.length, 'angular app(s)')
console.log('[-] Apps name(s):')
for (i = 0; i < apps.length; i++) {
  console.log('  -', $(apps[i]).attr('ng-app'))
}

for (i = 0; i < apps.length; i++) {
  var appId = i
  var appDOM = angular.element(apps[i])
  var appName = appDOM.attr('ng-app')
  console.log('[>] Analysis of ', "'" + appName + "'")
  var scope = appDOM.scope()
  if (scope) {
    console.log('[-] Found', appName, 'scope', scope)
  } else {
    console.log('[-] Could not use', appName, 'scope')
  }
  var app = angular.module(appName)
  addInterceptor(app)

  // Get routes depending on which type of router was loaded
  infectApp(app)
  findControllers(appName)
}

function findControllers (appName) {
  setTimeout(function () {
    console.log('[-] Everything should be loaded')
    var apps = $('[ng-app]')
    var app
    for (var i = 0; i < apps.length; i++) {
      if ($(apps[i]).attr('ng-app') === appName) {
        app = $(apps[i])
      }
    }

    if (!app) {
      console.log('[!] Could not find the same app...', appName)
      return
    }

    var ctrls = app.find('[ng-controller]')
    if (app.attr('ng-controller')) {
      ctrls.push(app)
    }
    console.log('[-] Looking for controllers in', appName)
    console.log('[-] Found', ctrls.length, 'controllers')
    for (var j = 0; j < ctrls.length; j++) {
      var ctrlDOM = angular.element(ctrls[j])
      var ctrlName = ctrlDOM.attr('ng-controller')
      console.log('  -', ctrlName)

      var scope = ctrlDOM.scope()
      inspectScope(scope)
    }
  }, 1500)
}

function infectApp (app) {
  console.log('[-] Add Inspector to angular app')
  console.log('[-] App requires:')
  logInvokeQueue(app)
  for (var i = 0; i < app.requires.length; i++) {
    console.log(' -', app.requires[i])
  }
  if (app.requires.indexOf('ui.router') !== -1) {
    console.log('[-] Router is ui.router')
    app.run(['$state', '$sce', '$http', '$stateParams', '$rootScope',
      function ($state, $sce, $http, $stateParams, $rootScope) {
        inspectScope($rootScope)
        console.log('angular ui router (ui.router)')
        var routes = $state.get()
        // logInvokeQueue(app)
        findPartials($http, routes, $stateParams)
      }
    ])
  } else if (app.requires.indexOf('ngRouter') !== -1) {
    console.log('[-] Router is ngRoute')
    app.run(['$route', '$sce', function ($route, $sce) {
      console.log('routes', $route.routes)
    }])
  } else {
    console.log('[-] Could not determine router :(')
  }
  app.run([function () {
    console.log('[-] Could load app.run()')
  }])
}

var countScopes = 0

function inspectScope (scope) {
  console.log('[-] Inspection of scope', countScopes++)
  for (var i in scope) {
    if (typeof i === 'string' && i[0] === '$') continue
    if (typeof scope[i] !== 'function') {
      console.log('\t', i, typeof scope[i], typeof scope[i] !== 'object' ? scope[i] : '[object]')
    } else {
      console.log('\t', i, 'function')
    }
  }
  for (var cs = scope.$$childHead; cs; cs = cs.$$nextSibling) {
    inspectScope(cs)
  }
}

function logInvokeQueue (app) {
  console.log('[-] InvokeQueue contains:')
  for (var i = 0; i < app._invokeQueue.length; i++) {
    console.log(' [' + i + ']', app._invokeQueue[i][0], app._invokeQueue[i][1])
    if (typeof app._invokeQueue[i] === 'string') {
      continue
    }
    if (typeof app._invokeQueue[i] === 'function') {
      continue
    }
    for (var j = 2; j < app._invokeQueue[i].length; j++) {
      if (typeof app._invokeQueue[i][j] === 'function') {
        continue
      }
      console.log('   [' + j + ']', app._invokeQueue[i][j])
      if (typeof app._invokeQueue[i][j] === 'string') {
        continue
      }
      for (var k = 0; k < app._invokeQueue[i][j].length; k++) {
        if (typeof app._invokeQueue[i][j][k] === 'function') {
          continue
        }
        console.log('    [' + k + ']', app._invokeQueue[i][j][k])
      }
    }
  }
}

function findPartials ($http, routes, $stateParams) {
  for (var j = 0; j < routes.length; j++) {
    let k = j
    if (routes[j].templateUrl) {
      $http({
        method: 'GET',
        url: routes[j].templateUrl
      })
      .then(function (response) {
        findInputs(routes[k], response.data)
      })
    } else if (routes[j].template) {
      findInputs(routes[j].template)
    } else if (routes[j].templateProvider) {
      findInputs(routes[j].templateProvider($stateParams))
    }
  }
}

function findInputs (route, html) {
  var root = $('<div/>').html(html)
  var inputs = root.find('input')
  var buttons = root.find('button')
  var submits = []
  for (var i = 0; i < inputs.length; i++) {
    var elem = $(inputs[i])
    console.log('input', {
      tag: 'input',
      route: route.url,
      type: elem.attr('type'),
      id: elem.attr('id'),
      name: elem.attr('name'),
      val: elem.val(),
      required: elem.attr('required') || elem.attr('ng-required'),
      submit: elem.attr('ng-click') || elem.attr('onclick')
    })
    if (elem.attr('type') === 'submit') {
      submits.push(elem)
    }
  }
  for (var j = 0; j < buttons.length; j++) {
    var button = $(buttons[j])
    console.log('button', {
      tag: 'button',
      route: route.url,
      type: button.attr('type'),
      id: button.attr('id'),
      name: button.attr('name'),
      val: button.html(),
      submit: button.attr('ng-click') || button.attr('onclick')
    })
    submits.push(button)
  }

  findForms(submits, root)

  return {submits, inputs, root}
}

function findForms (submits, root, module) {
  var forms = root.find('form')
  if (!forms.length) {
    return
  }
  for (var k = 0; k < submits.length; k++) {
    var submit = $(submits[k])
    var form
    var parent = submit
    do {
      parent = parent.parent()
      for (var l = 0; l < forms.length; l++) {
        if (forms[l] === parent[0]) {
          form = $(forms[l])
        }
      }
    } while (!form && parent.parent() && parent.parent().length !== 0)

    if (form) {
      console.log('form', {
        submit: form.attr('ng-submit') || form.attr('action'),
        form_disabled: form.attr('ng-disabled'),
        submit_disabled: submit.attr('ng-disabled'),
        method: form.attr('method')
      })
    }
  }
}

function addInterceptor (app) {
  console.log('[-] Add HTTP Requests interceptor')
  app.factory('angularScraperInterceptor', ['$q', '$rootScope', '$location', '$timeout',
    function ($q, $rootScope, $location, $timeout) {
      console.log('>>>> angularScraperInterceptor')
      return {
        request: function (config) {
          if (!silentRequests) {
            console.log('[-] request', config.method, config.url, config)
          }
          return config
        },
        requestError: function (rejection) {
          if (!silentRequests) {
            console.log('[-] requestError', rejection)
          }
          return $q.reject(rejection)
        },
        response: function (response) {
          if (!silentRequests) {
            console.log('[-] response', response.config.url, response.status, response)
          }
          return response
        },
        responseError: function (response) {
          if (!silentRequests) {
            console.log('[-] responseError', response.config.method, response.config.url, response.status, response)
          }
          return $q.reject(response)
        }
      }
    }
  ])
  .config(['$httpProvider', function ($httpProvider) {
    console.log('[-] Register interceptors', $httpProvider)
    if ($httpProvider.interceptors) {
      $httpProvider.interceptors.push('angularScraperInterceptor')
    } else {
      console.log('[!] This version of angular is too old of this shit ( < 1.2.0)')
    }
  }])
}
