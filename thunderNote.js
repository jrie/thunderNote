// --------------------------------------------------------------------------------------------------------------------------------
// Localization
function getFirefoxMessage (messageName, params) {
  if (params !== undefined) return browser.i18n.getMessage(messageName, params)
  return browser.i18n.getMessage(messageName)
}

let getMsg = getFirefoxMessage

// -------------------------------------------------------------------------------------------------------

function generateZip (rawData) {
  let data = JSON.stringify(rawData)
  let zip = new JSZip()
  zip.file('thunderNote.json', data)

  zip.generateAsync({ 'type': 'blob' }).then(function (blob) {
    let dlLink = document.createElement('a')
    dlLink.href = URL.createObjectURL(blob)

    let dateObj = new Date()
    dlLink.download = 'thunderNote_' + dateObj.getFullYear().toString() + '-' + (dateObj.getMonth() + 1).toString() + '-' + dateObj.getDate().toString() + '.zip'
    document.body.appendChild(dlLink)
    dlLink.click()
    dlLink.parentNode.removeChild(dlLink)
    URL.revokeObjectURL(dlLink.href)
  })
}

// --------------------------------------------------------------------------------------------------------------------------------
function exportSettings () {
  browser.storage.local.get().then(function (data) { generateZip(data) }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function triggerImport () {
  browser.runtime.getBackgroundPage().then(function (bgPage) {
    bgPage.document.adoptNode(document.querySelector('#importFile')).addEventListener('change', bgPage.importSettings)
  }, errorHandle)
}

// document.querySelector('#importFile').addEventListener('click', triggerImport)

// --------------------------------------------------------------------------------------------------------------------------------
function isEnabled () {
  return document.querySelector('#setThunderNoteState').value === 'enabled'
}

// --------------------------------------------------------------------------------------------------------------------------------

function setFocus(element) {
  setTimeout(function() { document.querySelector(element).focus() }, 700)
}

// --------------------------------------------------------------------------------------------------------------------------------

function handleButtons (evt) {
  document.querySelector('.headerControl').classList.remove('inactive')

  for (let page of document.querySelectorAll('.page')) page.classList.remove('active')

  let addButton = document.querySelector('.controlButton[data-cmd="add"]')
  let removalButton = document.querySelector('.controlButton[data-cmd="removeFeed"]')
  let forceUpdateButton = document.querySelector('.controlButton[data-cmd="forceUpdate"]')

  for (let item of document.querySelectorAll('.inititalHidden')) item.classList.add('hidden')

  document.removeEventListener('keyup', handleKeyUp)
  activeNews = -1

  let focusNode = null

  switch (evt.target.dataset['cmd']) {
    case 'addItem':
      if (evt.target.dataset['url'] === undefined) {
        document.querySelector('#feedURI').value = ''
        document.querySelector('#feedType').value = 'rss'
        document.querySelector('#feedInterval').value = ''
        document.querySelector('#feedMaxAge').value = ''

        removalButton.classList.add('hidden')
        forceUpdateButton.classList.add('hidden')

        addButton.textContent = getMsg('buttonAddURI')
      } else {
        removalButton.dataset['url'] = evt.target.dataset['url']
        forceUpdateButton.dataset['url'] = evt.target.dataset['url']

        removalButton.classList.remove('hidden')
        forceUpdateButton.classList.remove('hidden')

        addButton.textContent = getMsg('buttonUpdateURI')
        for (let item of document.querySelectorAll('.inititalHidden')) item.classList.remove('hidden')
      }

      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      document.querySelector('.headerControl').classList.add('inactive')
      focusNode = '#feedURI'
      break
    case 'add':
      let url = document.querySelector('#feedURI').value
      let type = document.querySelector('#feedType').value
      let crawlTime = parseInt(document.querySelector('#feedInterval').value)
      let maxAge = parseInt(document.querySelector('#feedMaxAge').value)

      if (isNaN(maxAge)) maxAge = 0

      if (url === '' || isNaN(crawlTime)) {
        document.querySelector('.headerControl').classList.add('inactive')
        document.querySelector('.page[data-src="addItem"]').classList.add('active')
        return
      }

      browser.storage.local.get('feeds').then(function (data) {
        if (data['feeds'] === undefined) data['feeds'] = {}
        data['feeds'][url] = [type, crawlTime, maxAge]

        browser.storage.local.set(data)
        if (isEnabled()) browser.alarms.create(url, { 'when': Date.now() + 250, 'periodInMinutes': crawlTime })
      }, errorHandle)
      break

    case 'manageURIs':
      fillURIs()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      break
    case 'manageKeywords':
      fillKeywords()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '#addKeywordInput'
      break
    case 'viewTopics':
      fillTopics()
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      document.addEventListener('keyup', handleKeyUp)
      for (let item of document.querySelectorAll('a.entryTitle')) item.addEventListener('focus', function (evt) { activeNews = evt.target.dataset['index'] })
      break
    default:
      break
  }

  let domNodes = document.querySelectorAll('*')
  for (let item of domNodes) item.setAttribute('tabindex', -1)

  let activePage = document.querySelector('.page.active')

  let tabIndex = 1
  if (activePage !== null) {
    browser.sidebarAction.setTitle({ 'title': document.querySelector('.headerControl h2').textContent + ': ' + activePage.querySelector('h2').textContent })
    for (let child of activePage.children) {
      if ((child.nodeName === 'BUTTON' && child.className !== 'backButton') || child.nodeName === 'INPUT' || child.nodeName === 'SELECT') child.setAttribute('tabindex', tabIndex++)
    }
  } else {
    for (let child of document.querySelector('.headerControl').children) child.setAttribute('tabindex', tabIndex++)
    browser.sidebarAction.setTitle({ 'title': document.querySelector('.headerControl h2').textContent })
  }

  if (focusNode !== null) setFocus(focusNode)
}

// --------------------------------------------------------------------------------------------------------------------------------

function errorHandle (error) {
  console.warn(getMsg('errorOccured'))
  console.warn(error)
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeFeed (evt) {
  let feedURI = evt.target.dataset['url']
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined && data['feeds'][feedURI] !== undefined) {
      browser.alarms.clear(feedURI)

      delete data['feeds'][feedURI]
      browser.storage.local.set(data).then(fillURIs)
    }
  }, errorHandle)
}

function forceUpdate (evt) {
  let feedURI = evt.target.dataset['url']
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined && data['feeds'][feedURI] !== undefined) {
      browser.alarms.clear(feedURI)
      browser.alarms.create(feedURI, { 'when': Date.now() + 250, 'periodInMinutes': data['feeds'][feedURI][1] })
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeChildren (element) {
  for (let x = 0; x < element.children.length; ++x) element.removeChild(element.children[x--])
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeKeyword (evt) {
  let feedKeyword = evt.target.dataset['key']
  browser.storage.local.get('keywords').then(function (data) {
    if (data['keywords'] !== undefined && data['keywords']['cnt'][feedKeyword] !== undefined) {
      delete data['keywords']['cnt'][feedKeyword]
      delete data['keywords']['urls'][feedKeyword]
      browser.storage.local.set(data).then(fillKeywords)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillURIs () {
  browser.storage.local.get('feeds').then(function (data) {
    let ul = document.querySelector('#manageURIs')
    ul.innerHTML = ''

    for (let url of Object.keys(data['feeds'])) {
      let li = document.createElement('li')
      let button = document.createElement('button')
      button.value = url
      button.className = 'controlButton removeFeed'
      button.dataset['cmd'] = 'addItem'
      button.dataset['url'] = url

      document.querySelector('#feedURI').value = url
      document.querySelector('#feedType').value = data['feeds'][url][0]
      document.querySelector('#feedInterval').value = data['feeds'][url][1]
      document.querySelector('#feedMaxAge').value = data['feeds'][url][2] === undefined ? 0 : data['feeds'][url][2]

      button.appendChild(document.createTextNode(url))
      button.addEventListener('click', handleButtons)
      li.appendChild(button)
      ul.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillKeywords () {
  browser.storage.local.get('keywords').then(function (data) {
    if (data['keywords'] === undefined) return
    let ul = document.querySelector('#manageKeywords')
    removeChildren(ul)

    for (let wordTrigger of Object.keys(data['keywords']['cnt'])) {
      let li = document.createElement('li')
      let button = document.createElement('button')
      button.value = wordTrigger
      button.className = 'controlButton removeKeyword'
      button.dataset['cmd'] = 'removeKeyword'
      button.dataset['key'] = wordTrigger

      button.appendChild(document.createTextNode(wordTrigger))
      button.addEventListener('click', removeKeyword)
      li.appendChild(button)
      ul.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function sortByTime (a, b) {
  return b[2] - a[2]
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillTopics () {
  browser.storage.local.get().then(function (data) {
    if (data['keywords'] === undefined) return
    let ul = document.querySelector('#viewTopics')
    removeChildren(ul)

    let sortedTopics = Object.keys(data['keywords']['cnt']).sort()
    if (Object.keys(data['keywords']['urls']).length === 0) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(getMsg('noTopics')))
      li.appendChild(subLine)
      ul.appendChild(li)
      return
    }

    let now = Date.now()
    let newsIndex = 0

    for (let keyword of sortedTopics) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(keyword))

      let subLineCount = document.createElement('span')
      subLineCount.className = 'subCount'
      subLineCount.appendChild(document.createTextNode(data['keywords']['cnt'][keyword] === 1 ? data['keywords']['cnt'][keyword] + ' item' : data['keywords']['cnt'][keyword] + ' items'))
      subLine.appendChild(subLineCount)
      li.appendChild(subLine)

      let hasDataChange = false
      for (let key of Object.keys(data['keywords']['urls'][keyword])) {
        let feedURI = data['keywords']['urls'][keyword][key][4]
        let feedMaxAge = data['feeds'][feedURI][2]
        if (feedMaxAge === 0) continue

        let age = Math.floor((now - data['keywords']['urls'][keyword][key][2]) / dayLength)
        if (age >= feedMaxAge) {
          delete data['keywords']['urls'][keyword][key]
          --data['keywords']['cnt'][keyword]
          hasDataChange = true
        }
      }

      if (hasDataChange) browser.storage.local.set(data)

      if (Object.keys(data['keywords']['urls'][keyword]).length === 0) {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)
        let entryTitle = document.createElement('span')
        entryTitle.className = 'entryTitle inactive'
        entryTitle.appendChild(document.createTextNode('---'))
        subList.appendChild(entryTitle)
      } else {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)

        let sortedNews = Object.values(data['keywords']['urls'][keyword]).sort(sortByTime)
        let keys = Object.keys(data['keywords']['urls'][keyword])
        for (let item of sortedNews) {
          for (let key of keys) {
            if (item[2] === data['keywords']['urls'][keyword][key][2] && item[4] === data['keywords']['urls'][keyword][key][4]) {
              let dateObj = new Date(item[2])

              let entryDate = document.createElement('span')
              entryDate.className = 'entryDate'
              entryDate.appendChild(document.createTextNode(dateObj.toLocaleString()))

              let entryTitle = document.createElement('a')
              entryTitle.href = key
              entryTitle.className = 'entryTitle'
              entryTitle.appendChild(document.createTextNode(item[0]))
              entryTitle.dataset['index'] = newsIndex++

              let entryContent = document.createElement('p')
              entryContent.className = 'entryContent'
              entryContent.innerHTML = filterHTML(item[3])

              subList.appendChild(entryDate)
              subList.appendChild(entryTitle)
              subList.appendChild(entryContent)
              break
            }
          }
        }
      }

      ul.appendChild(li)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function removeNodes (child) {
  for (let childNode of child.children) removeNodes(childNode)

  if (child.nodeName !== 'A' && child.nodeName !== 'P') {
    child.parentNode.appendChild(document.createTextNode(child.textContent))
    child.parentNode.removeChild(child)
  }
}

function filterHTML (item) {
  let p = document.createElement('p')
  p.innerHTML = item
  removeNodes(p)
  return p.innerHTML
}

// --------------------------------------------------------------------------------------------------------------------------------
function handleMessage (message) {
  if (message['addKeyword'] !== undefined) {
    fillKeywords()
    browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', message['addKeyword']) })
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function addInputKeyword (evt) {
  if (evt.keyCode !== 13) { return }

  let keywordText = evt.target.value.trim()
  if (keywordText.length === 0) return

  browser.storage.local.get('keywords').then(function (keywordData) {
    if (keywordData['keywords'] === undefined) keywordData['keywords'] = { 'cnt': {}, 'urls': {} }
    if (keywordData['keywords']['cnt'][keywordText] !== undefined) return

    keywordData['keywords']['cnt'][keywordText] = 0
    keywordData['keywords']['urls'][keywordText] = {}
    browser.storage.local.set(keywordData)

    fillKeywords()
    browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', keywordText) })
    evt.target.value = ''
    evt.target.focus()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleThunderNodeState (evt) {
  if (evt.target.value === 'disabled') {
    browser.alarms.clearAll()
    browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteDisabled') })
  } else {
    browser.storage.local.get('feeds').then(function (data) {
      if (data['feeds'] !== undefined) {
        for (let url of Object.keys(data['feeds'])) browser.alarms.create(url, { 'when': Date.now() + 250, 'periodInMinutes': data['feeds'][url][1] })
      }

      browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteEnabled') })
    }, errorHandle)

  }
}

// --------------------------------------------------------------------------------------------------------------------------------
let activeNews = -1
function handleKeyUp (evt) {
  if (evt.target.nodeName === 'INPUT' || evt.target.nodeName === 'BUTTON' || evt.target.nodeName === 'TEXTAREA') return
  if (evt.altKey) {
    // Alt key pressed
    let currentPage = document.querySelector('.page.active')
    let titleElements = document.querySelectorAll('#viewTopics a.entryTitle')

    if (evt.keyCode === 38) {
      evt.preventDefault()
      // arrow up
      if (activeNews === 0) activeNews = titleElements.length
      titleElements[--activeNews].focus()
      currentPage.scrollTo(0, titleElements[activeNews].offsetTop - (window.innerHeight * 0.5))
    } else if (evt.keyCode === 40) {
      evt.preventDefault()
      // arrow down
      if (activeNews >= titleElements.length - 1) activeNews = -1
      titleElements[++activeNews].focus()
    }
    currentPage.scrollTo(0, titleElements[activeNews].offsetTop - (window.innerHeight * 0.5))
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

for (let controlButton of document.querySelectorAll('.controlButton')) controlButton.addEventListener('click', handleButtons)
for (let backButton of document.querySelectorAll('.backButton')) backButton.addEventListener('click', handleButtons)

document.querySelector('.controlButton[data-cmd="removeFeed"]').addEventListener('click', removeFeed)
document.querySelector('.controlButton[data-cmd="forceUpdate"]').addEventListener('click', forceUpdate)
document.querySelector('#setThunderNoteState').addEventListener('change', toggleThunderNodeState)
document.querySelector('#addKeywordInput').addEventListener('keyup', addInputKeyword)
browser.runtime.onMessage.addListener(handleMessage)

// --------------------------------------------------------------------------------------------------------------------------------

const dayLength = 24 * 3600 * 1000.0

fillKeywords()
fillTopics()

let domNodes = document.querySelectorAll('*')
for (let item of domNodes) item.setAttribute('tabindex', -1)

// --------------------------------------------------------------------------------------------------------------------------------
