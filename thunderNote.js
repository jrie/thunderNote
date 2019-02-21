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

    if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('settingsExportedTitle'), 'message': getMsg('settingsExportedBody') })
  })
}

// --------------------------------------------------------------------------------------------------------------------------------
function exportSettings () {
  browser.storage.local.get().then(function (data) { generateZip(data) }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
function importSettings (evt) {
  if (evt.target.files[0] === undefined) return

  let file = evt.target.files[0]

  JSZip.loadAsync(file).then(function (zip) {
    if (zip.files['thunderNote.json'] === undefined) return

    zip.files['thunderNote.json'].async('string').then(async function (stringData) {
      let importData = JSON.parse(stringData)
      browser.storage.local.get().then(function (data) {
        if (importData['addon'] !== undefined) {
          if (data['addon'] === undefined) data['addon'] = {}

          for (let key of Object.keys(importData['addon'])) {
            if (data['addon'][key] === undefined) data['addon'][key] = importData['addon'][key]
          }
        }

        if (importData['feeds'] !== undefined) {
          if (data['feeds'] === undefined) data['feeds'] = {}

          for (let key of Object.keys(importData['feeds'])) {
            if (data['feeds'][key] === undefined) data['feeds'][key] = importData['feeds'][key]
          }
        }

        if (importData['feedData'] !== undefined) {
          if (data['feedData'] === undefined) data['feedData'] = {}

          for (let key of Object.keys(importData['feedData'])) {
            if (data['feedData'][key] === undefined) data['feedData'][key] = importData['feedData'][key]
            else {
              for (let news of Object.keys(importData['feedData'][key])) {
                if (data['feedData'][key][news] === undefined) data['feedData'][key][news] = importData['feedData'][key][news]
              }
            }
          }
        }

        if (importData['keywords'] !== undefined) {
          if (data['keywords'] === undefined) data['keywords'] = {}

          for (let key of Object.keys(importData['keywords'])) {
            if (data['keywords'][key] === undefined) data['keywords'][key] = importData['keywords'][key]
          }
        }

        browser.storage.local.set(data)

        if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('settingsImportedTitle'), 'message': getMsg('settingsImportedBody') })
      })
    })
  })
}

document.querySelector('#importFile').addEventListener('change', importSettings)

// --------------------------------------------------------------------------------------------------------------------------------
function isEnabled () {
  return document.querySelector('#setThunderNoteState').value === 'enabled'
}

// --------------------------------------------------------------------------------------------------------------------------------

function setFocus (element) {
  browser.storage.local.get('addon').then(function (data) {
    if (data['addon']['animations'] === 'enabled') {
      setTimeout(function () { document.querySelector(element).focus() }, 700)
    } else document.querySelector(element).focus()
  })
}

// --------------------------------------------------------------------------------------------------------------------------------

function hideContent () {
  let items = document.querySelectorAll('.page.active ul.subList .entryContent')
  if (inHeaderOnlyMode) for (let item of items) item.classList.add('subHidden')
  else for (let item of items) item.classList.remove('subHidden')
}

// --------------------------------------------------------------------------------------------------------------------------------

function handleButtons (evt) {
  switch (evt.target.dataset['cmd']) {
    case 'importAddonData':
      return
    case 'exportAddonData':
      exportSettings()
      return
    case 'switchSingleRow':
      activeNews = 0
      activeFeedItem = 0
      inSingleRowMode = !inSingleRowMode
      if (inSingleRowMode === false) for (let item of document.querySelectorAll('.singleRow')) item.classList.remove('singleRow')

      let activePage = document.querySelector('.page.active')

      let indexStart = -1
      if (activePage.dataset['src'] === 'viewTopics') {
        fillTopics()
        indexStart = activeNews
      } else if (activePage.dataset['src'] === 'viewFeeds') {
        fillViews()
        indexStart = activeFeedItem
      }

      if (indexStart !== -1) {
        queryResize()
        setTimeout(function () {
          let currentPage = document.querySelector('.page.active')
          let titleElements = document.querySelectorAll('.page.active a.entryTitle')

          if (titleElements !== null && titleElements[indexStart] !== undefined) {
            titleElements[indexStart].parentNode.parentNode.focus()
            titleElements[indexStart].parentNode.classList.add('highlight')
            currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.425))
          }
        }, 45)
      }


      if (activePage.dataset['src'] === 'viewTopics') fillTopics()
      else if (activePage.dataset['src'] === 'viewFeeds') fillViews()

      return
    case 'switchHeaderViewMode':
      inHeaderOnlyMode = !inHeaderOnlyMode
      hideContent()
      return
    default:
      break
  }

  document.querySelector('.headerControl').classList.remove('inactive')

  for (let page of document.querySelectorAll('.page')) page.classList.remove('active')

  let addButton = document.querySelector('.controlButton[data-cmd="add"]')
  let removalButton = document.querySelector('.controlButton[data-cmd="removeFeed"]')
  let forceUpdateButton = document.querySelector('.controlButton[data-cmd="forceUpdate"]')

  //document.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('keydown', handleKeyUp)

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
        addButton.dataset['srcUrl'] = ''
      } else {
        document.querySelector('#feedURI').value = evt.target.dataset['url']

        browser.storage.local.get('feeds').then(function (data) {
          let url = document.querySelector('#feedURI').value
          document.querySelector('#feedType').value = data['feeds'][url][0]
          document.querySelector('#feedInterval').value = data['feeds'][url][1]
          document.querySelector('#feedMaxAge').value = data['feeds'][url][2]
        })

        removalButton.dataset['url'] = evt.target.dataset['url']
        forceUpdateButton.dataset['url'] = evt.target.dataset['url']

        removalButton.classList.remove('hidden')
        forceUpdateButton.classList.remove('hidden')

        addButton.textContent = getMsg('buttonUpdateURI')
        addButton.dataset['srcUrl'] = evt.target.dataset['url']
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

      browser.storage.local.get().then(function (data) {
        if (data['feeds'] === undefined) data['feeds'] = {}

        let srcUrl = evt.target.dataset['srcUrl']
        if (srcUrl.length !== 0 && srcUrl !== url) {
          browser.alarms.clear(srcUrl)

          if (data['feeds'][srcUrl] !== undefined) {
            delete data['feeds'][srcUrl]

            data['feedData'][url] = data['feedData'][srcUrl]
            delete data['feedData'][srcUrl]
          }

          evt.target.dataset['srcUrl'] = ''
        }

        browser.alarms.clear(url)
        data['feeds'][url] = [type, crawlTime, maxAge, 0]
        browser.storage.local.set(data).then(function () {
          if (isEnabled()) browser.alarms.create(url, { 'when': Date.now() + 150, 'periodInMinutes': crawlTime })
        })
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
      activeNews = 0
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      document.addEventListener('keydown', handleKeyUp)
      //document.addEventListener('keyup', handleKeyUp)
      break
    case 'viewFeeds':
      fillViews()
      activeFeedItem = 0
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      //document.addEventListener('keyup', handleKeyUp)
      document.addEventListener('keydown', handleKeyUp)
      break
    case 'displayOptions':
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
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

  if (evt.target.className === 'backButton' || !document.querySelector('.headerControl').classList.contains('inactive')) {
    browser.storage.local.get('addon').then(function (data) {
      if (data['addon']['animations'] !== 'enabled') for (let item of document.querySelectorAll('.inititalHidden')) item.classList.add('hidden')
      else setTimeout(function () { for (let item of document.querySelectorAll('.inititalHidden')) item.classList.add('hidden') }, 750)
    })
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function errorHandle (error) {
  console.warn(getMsg('errorOccured'))
  console.warn(error)
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeFeed (evt) {
  let feedURI = evt.target.dataset['url']
  browser.storage.local.get().then(function (data) {
    if (data['feeds'] !== undefined && data['feeds'][feedURI] !== undefined) {
      browser.alarms.clear(feedURI)

      delete data['feeds'][feedURI]
      delete data['feedData'][feedURI]

      if (Object.keys(data['feeds']).length === 0) {
        browser.storage.local.remove(['feeds', 'feedData'])
      } else browser.storage.local.set(data).then(fillURIs, errorHandle)
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function forceUpdate (evt) {
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined) {
      let feedURI = evt.target.dataset['url']
      if (data['feeds'][feedURI] !== undefined) {
        browser.alarms.clear(feedURI)
        browser.alarms.create(feedURI, { 'when': Date.now() + 150, 'periodInMinutes': data['feeds'][feedURI][1] })
      }
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function forceUpdateAll (evt) {
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined) {
      browser.alarms.clearAll()
      let updateSchedule = 0
      for (let feedURI of Object.keys(data['feeds'])) {
        browser.alarms.create(feedURI, { 'when': Date.now() + (updateSchedule * 1000), 'periodInMinutes': data['feeds'][feedURI][1] })
        ++updateSchedule
      }
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
      browser.storage.local.set(data).then(fillKeywords, errorHandle)
      document.querySelector('#addKeywordInput').focus()
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillURIs () {
  browser.storage.local.get('feeds').then(function (data) {
    let ul = document.querySelector('#manageURIs')
    removeChildren(ul)

    if (data['feeds'] === undefined || Object.keys(data['feeds']).length === 0) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('p')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(getMsg('noFeeds')))
      li.appendChild(subLine)
      ul.appendChild(li)
      return
    }

    for (let item of document.querySelectorAll('.inititalHidden')) item.classList.remove('hidden')

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

function sortByTimeFeeds (a, b) {
  return b[1] - a[1]
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillViews () {
  browser.storage.local.get().then(function (data) {
    let ul = document.querySelector('#viewFeeds')
    removeChildren(ul)

    if (inSingleRowMode) ul.classList.add('singleRow')

    if (data['feedData'] === undefined || Object.keys(data['feedData']).length === 0) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('p')
      subLine.className = 'subTitle'
      if (data['feedData'] === undefined) {
        subLine.appendChild(document.createTextNode(getMsg('noFeeds')))
      } else if (Object.keys(data['feedData']).length === 0) {
        subLine.appendChild(document.createTextNode(getMsg('noFeedItems')))
      }

      li.appendChild(subLine)
      ul.appendChild(li)

      let clone = document.querySelector('.controlButton[data-cmd="addItem"]').cloneNode(true)
      clone.classList.add('marginTop')
      clone.addEventListener('click', handleButtons)

      ul.appendChild(clone)
      return
    }

    for (let item of document.querySelectorAll('.inititalHidden')) item.classList.remove('hidden')

    let sortedFeeds = Object.keys(data['feedData']).sort()
    let now = Date.now()

    let imagesAllowed = data['addon']['images'] === 'enabled'

    for (let feedURI of sortedFeeds) {
      let fold = document.createElement('button')
      let li = document.createElement('li')

      if (inSingleRowMode) li.className = 'newsEntry singleRow'
      else li.className = 'newsEntry'

      fold.className = 'folding'
      fold.innerHTML = '&laquo;'

      fold.innerHTML = '&raquo;'

      fold.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.style['opacity'] = 1
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '12px'
          setTimeout(function () {
            let currentPage = document.querySelector('.page.active')
            currentPage.scrollTo(0, evt.target.parentNode.children[2].offsetTop - (window.innerHeight * 0.425))

            evt.target.parentNode.children[2].children[0].focus()
            evt.target.parentNode.children[2].children[0].classList.add('highlight')
          }, 450)
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.children[2].clientHeight).toString() + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&laquo'
          evt.target.parentNode.lastElementChild.style['opacity'] = 0
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '-24px'
        }
      })

      let foldBottom = document.createElement('button')
      foldBottom.className = 'folding bottom'
      foldBottom.innerHTML = fold.innerHTML

      foldBottom.addEventListener('click', function (evt) {
        evt.target.parentNode.classList.add('folded')
        evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.children[2].clientHeight).toString() + 'px'
        evt.target.innerHTML = '&laquo;'
        evt.target.parentNode.firstElementChild.innerHTML = '&laquo;'
        evt.target.style['opacity'] = 0
        evt.target.style['margin-bottom'] = '-24px'
      })

      li.appendChild(fold)

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(getMsg('titleFeedOverviewFeed')))

      let feedName = document.createElement('h3')
      feedName.className = 'feedName'
      feedName.appendChild(document.createTextNode(feedURI))
      subLine.appendChild(feedName)

      let hasDataChange = false
      for (let newsItemKey of Object.keys(data['feedData'][feedURI])) {
        let newsItem = data['feedData'][feedURI][newsItemKey]
        let feedMaxAge = data['feeds'][feedURI][2]
        if (feedMaxAge === 0) continue

        let age = Math.floor((now - newsItem[1]) / dayLength)
        if (age >= feedMaxAge) {
          delete data['feedData'][feedURI][newsItemKey]
          hasDataChange = true
        }
      }

      if (hasDataChange) browser.storage.local.set(data)

      li.appendChild(subLine)

      if (Object.keys(data['feedData'][feedURI]).length === 0) {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)

        let entryTitle = document.createElement('li')
        entryTitle.className = 'entryContent inactive'
        entryTitle.appendChild(document.createTextNode(getMsg('noTopics')))
        subList.appendChild(entryTitle)
      } else {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)

        let sortedNews = Object.values(data['feedData'][feedURI]).sort(sortByTimeFeeds)
        for (let item of sortedNews) {
          let liSub = document.createElement('li')

          let dateObj = new Date(item[1])

          let entryDate = document.createElement('span')
          entryDate.className = 'entryDate'
          entryDate.appendChild(document.createTextNode(dateObj.toLocaleString()))

          let entryTitle = document.createElement('a')
          entryTitle.href = item[3]
          entryTitle.title = item[3]
          entryTitle.className = 'entryTitle'
          entryTitle.appendChild(document.createTextNode(item[0]))

          let entryContent = document.createElement('div')
          entryContent.className = 'entryContent'
          entryContent.classList.add('noImg')
          if (imagesAllowed) {
            if (item[4] !== null) {
              let entryImg = document.createElement('img')
              entryImg.src = item[4]
              entryContent.appendChild(entryImg)
              entryContent.classList.remove('noImg')
            }
          }

          let pContent = document.createElement('p')
          pContent.innerHTML += filterHTML(item[2])
          entryContent.appendChild(pContent)

          liSub.appendChild(entryDate)
          liSub.appendChild(entryTitle)
          liSub.appendChild(entryContent)

          subList.appendChild(liSub)
        }

        li.appendChild(subList)

        if (inSingleRowMode) {
          let buttonBackwards = document.createElement('button')
          buttonBackwards.className = 'slideButton clearfix button left'
          buttonBackwards.textContent = '<'
          buttonBackwards.dataset['cmd'] = 'left'
          buttonBackwards.addEventListener('click', navigateFeed)

          let buttonForward = document.createElement('button')
          buttonForward.className = 'slideButton button right'
          buttonForward.textContent = '>'
          buttonForward.dataset['cmd'] = 'right'
          buttonForward.addEventListener('click', navigateFeed)

          li.appendChild(buttonBackwards)
          li.appendChild(buttonForward)
        }
      }

      let currentDisplay = document.createElement('span')
      if (inSingleRowMode) {
        currentDisplay.className = 'singleNewsIndex'
        currentDisplay.dataset['src'] = feedURI
        li.children[2].children.length === 1 ? currentDisplay.textContent = getMsg('itemCountSingular', [1, 1]) : currentDisplay.textContent = getMsg('itemCountPlural', [1, li.children[2].children.length])
        subLine.appendChild(currentDisplay)
      }

      li.appendChild(foldBottom)
      ul.appendChild(li)
    }

    hideContent()
    queryResize()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function fillTopics () {
  browser.storage.local.get().then(function (data) {
    let ul = document.querySelector('#viewTopics')
    removeChildren(ul)
    if (inSingleRowMode) ul.classList.add('singleRow')

    if (data['keywords'] === undefined || data['keywords']['urls'] === undefined || Object.keys(data['keywords']['urls']).length === 0) {
      let li = document.createElement('li')
      li.className = 'newsEntry'

      let subLine = document.createElement('p')
      subLine.className = 'subTitle'
      if (data['feeds'] === undefined || Object.keys(data['feeds']).length === 0) {
        subLine.appendChild(document.createTextNode(getMsg('noTopics')))
      } else {
        subLine.appendChild(document.createTextNode(getMsg('noKeywords')))
      }

      li.appendChild(subLine)
      ul.appendChild(li)

      let clone = document.querySelector('.controlButton[data-cmd="manageKeywords"]').cloneNode(true)
      clone.classList.add('marginTop')
      clone.addEventListener('click', handleButtons)

      ul.appendChild(clone)
      return
    }

    for (let item of document.querySelectorAll('.inititalHidden')) item.classList.remove('hidden')

    let sortedTopics = Object.keys(data['keywords']['cnt']).sort()
    let now = Date.now()
    let newsIndex = 0

    let imagesAllowed = data['addon']['images'] === 'enabled'

    for (let keyword of sortedTopics) {
      let fold = document.createElement('button')
      let li = document.createElement('li')

      if (inSingleRowMode) li.className = 'newsEntry singleRow'
      else li.className = 'newsEntry'

      fold.className = 'folding'
      fold.innerHTML = '&laquo;'

      if (ul.children.length > 0) fold.innerHTML = '&raquo;'

      fold.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.style['opacity'] = 1
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '12px'
          setTimeout(function () {
            let currentPage = document.querySelector('.page.active')
            currentPage.scrollTo(0, evt.target.parentNode.children[2].offsetTop - (window.innerHeight * 0.425))

            evt.target.parentNode.children[2].children[0].focus()
            evt.target.parentNode.children[2].children[0].classList.add('highlight')
          }, 450)
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.children[2].clientHeight).toString() + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&laquo'
          evt.target.parentNode.lastElementChild.style['opacity'] = 0
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '-24px'
        }
      })

      let foldBottom = document.createElement('button')
      foldBottom.className = 'folding bottom'
      foldBottom.innerHTML = fold.innerHTML

      foldBottom.addEventListener('click', function (evt) {
        evt.target.parentNode.classList.add('folded')
        evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.children[2].clientHeight).toString() + 'px'
        evt.target.innerHTML = '&laquo;'
        evt.target.parentNode.firstElementChild.innerHTML = '&laquo;'
        evt.target.style['opacity'] = 0
        evt.target.style['margin-bottom'] = '-24px'
      })

      li.appendChild(fold)

      let subLine = document.createElement('h2')
      subLine.className = 'subTitle'
      subLine.appendChild(document.createTextNode(keyword))

      let subLineCount = document.createElement('span')
      subLineCount.className = 'subCount'
      subLineCount.appendChild(document.createTextNode(data['keywords']['cnt'][keyword] === 1 ? getMsg('itemSingular', data['keywords']['cnt'][keyword]) : getMsg('itemPlural', data['keywords']['cnt'][keyword])))
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

        let entryTitle = document.createElement('li')
        entryTitle.className = 'entryContent inactive'
        entryTitle.appendChild(document.createTextNode(getMsg('noTopics')))
        subList.appendChild(entryTitle)
      } else {
        let subList = document.createElement('ul')
        subList.className = 'subList'
        li.appendChild(subList)

        let sortedNews = Object.values(data['keywords']['urls'][keyword]).sort(sortByTime)
        let keys = Object.keys(data['keywords']['urls'][keyword])
        for (let item of sortedNews) {
          let liSub = document.createElement('li')

          for (let key of keys) {
            if (item[2] === data['keywords']['urls'][keyword][key][2] && item[4] === data['keywords']['urls'][keyword][key][4]) {
              let dateObj = new Date(item[2])

              let entryDate = document.createElement('span')
              entryDate.className = 'entryDate'
              entryDate.appendChild(document.createTextNode(dateObj.toLocaleString()))

              let entryTitle = document.createElement('a')
              entryTitle.href = key
              entryTitle.title = key
              entryTitle.className = 'entryTitle'
              entryTitle.appendChild(document.createTextNode(item[0]))
              entryTitle.addEventListener('click', function (evt) {
                highlightKey = evt.target.parentNode.parentNode.parentNode.childNodes[1].firstChild.textContent
                setTimeout(function () {
                  browser.find.find(highlightKey).then(function (matches) {
                    browser.find.highlightResults()
                  })
                }, 1200)
              })

              let entryContent = document.createElement('div')
              entryContent.className = 'entryContent'
              entryContent.classList.add('noImg')
              if (imagesAllowed) {
                if (item[5] !== undefined) {
                  let entryImg = document.createElement('img')
                  entryImg.src = item[5]
                  entryContent.appendChild(entryImg)
                  entryContent.classList.remove('noImg')
                }
              }

              let pContent = document.createElement('p')
              pContent.textContent += filterHTML(item[3])
              entryContent.appendChild(pContent)

              liSub.appendChild(entryDate)
              liSub.appendChild(entryTitle)
              liSub.appendChild(entryContent)
              break
            }
          }

          subList.appendChild(liSub)
        }

        li.appendChild(subList)

        if (inSingleRowMode) {
          let buttonBackwards = document.createElement('button')
          buttonBackwards.className = 'slideButton clearfix button left'
          buttonBackwards.textContent = '<'
          buttonBackwards.dataset['cmd'] = 'left'
          buttonBackwards.addEventListener('click', navigateFeed)

          let buttonForward = document.createElement('button')
          buttonForward.className = 'slideButton button right'
          buttonForward.textContent = '>'
          buttonForward.dataset['cmd'] = 'right'
          buttonForward.addEventListener('click', navigateFeed)

          li.appendChild(buttonBackwards)
          li.appendChild(buttonForward)
        }
      }

      let currentDisplay = document.createElement('span')
      if (inSingleRowMode) {
        currentDisplay.className = 'singleNewsIndex'
        currentDisplay.dataset['src'] = keyword
        li.children[2].children.length === 1 ? currentDisplay.textContent = getMsg('itemCountSingular', [1, 1]) : currentDisplay.textContent = getMsg('itemCountPlural', [1, li.children[2].children.length])
        subLine.appendChild(currentDisplay)
      }

      li.appendChild(foldBottom)
      ul.appendChild(li)
    }

    hideContent()
    queryResize()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function queryResize (evt) {
  if (inSingleRowMode) {
    let inititialWidth = parseInt(document.querySelector('body').clientWidth * 0.925) - 1
    for (let subList of document.querySelectorAll('.page.active .subList')) {
      subList.style['width'] = inititialWidth * (subList.children.length) + 'px'
      subList.style['overflow'] = 'hidden'
      subList.style['opacity'] = '1'
      subList.style['transform'] = 'translateX(0px)'
      let num = 0
      for (let element of subList.children) {
        element.style['width'] = inititialWidth + 'px'
        element.style['float'] = 'left'
      }

      let currentPage = document.querySelector('.page.active')
      if (currentPage.dataset['src'] === 'viewTopics') subList.style['transform'] = 'translateX(-' + (activeNews * inititialWidth).toString() + 'px)'
      else if (currentPage.dataset['src'] === 'viewFeeds') subList.style['transform'] = 'translateX(-' + (activeFeedItem * inititialWidth).toString() + 'px)'
    }
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function removeNodes (child) {
  for (let childNode of child.children) removeNodes(childNode)

  if (child.nodeName !== 'A' && child.nodeName !== 'P') {
    child.parentNode.appendChild(document.createTextNode(child.textContent))
    child.parentNode.removeChild(child)
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function filterHTML (item) {
  let p = document.createElement('p')
  p.innerHTML = item
  removeNodes(p)
  return p.innerHTML
}

// --------------------------------------------------------------------------------------------------------------------------------
function handleMessage (message) {
  if (message['addKeyword'] !== undefined) {
    browser.storage.local.get().then(function (data) {
      if (data['keywords'] === undefined) data['keywords'] = { 'cnt': {}, 'urls': {} }
      if (data['keywords']['cnt'][data] !== undefined) return

      data['keywords']['cnt'][message['addKeyword']] = 0
      data['keywords']['urls'][message['addKeyword']] = {}
      browser.storage.local.set(data)
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', keywordText) })
    }, errorHandle)

    browser.storage.local.get('addon').then(function (data) {
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', message['addKeyword']) })
    })

    fillKeywords()
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function addInputKeyword (evt) {
  if (evt.keyCode !== 13) { return }

  let keywordText = evt.target.value.trim()
  if (keywordText.length === 0) return

  browser.storage.local.get().then(function (data) {
    if (data['keywords'] === undefined) data['keywords'] = { 'cnt': {}, 'urls': {} }
    if (data['keywords']['cnt'][data] !== undefined) return

    data['keywords']['cnt'][keywordText] = 0
    data['keywords']['urls'][keywordText] = {}
    browser.storage.local.set(data)

    fillKeywords()
    if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', keywordText) })
    evt.target.value = ''
    evt.target.focus()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleThunderNodeState (evt) {
  browser.storage.local.get().then(function (data) {
    data['addon']['status'] = evt.target.value
    browser.storage.local.set(data)

    if (!isEnabled()) {
      browser.alarms.clearAll()
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteDisabled') })
    } else {
      if (data['feeds'] !== undefined) {
        let updateSchedule = 0
        for (let url of Object.keys(data['feeds'])) {
          browser.alarms.create(url, { 'when': Date.now() + (updateSchedule * 1000), 'periodInMinutes': data['feeds'][url][1] })
          ++updateSchedule
        }
      }

      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteEnabled') })
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
let activeNews = 0
let activeFeedItem = 0

function navigateFeed (evt) {
  if (!inSingleRowMode) return

  let current = evt.target.parentNode.querySelector('.highlight')
  for (let highlightedItem of evt.target.parentNode.parentNode.querySelectorAll('.highlight')) {
    if (highlightedItem !== current) highlightedItem.classList.remove('highlight')
  }

  let childLists = evt.target.parentNode.querySelectorAll('li')
  let width = parseInt(childLists[0].style['width'])
  let currentX = 0
  let hidden = evt.target.parentNode.querySelectorAll('.tempHidden')
  let hasHidden = hidden.length !== 0
  let next = null
  let isSameRoot = true

  if (current === null || current.parentNode.parentNode !== evt.target.parentNode) {
    current = evt.target.parentNode.querySelector('li')
    currentX = parseInt(current.parentNode.style['transform'].match(/[\d]+/))
    let targetX = 0

    if (evt.target.dataset['cmd'] === 'right') targetX = currentX + width
    else targetX = currentX

    if (targetX < 0) targetX = 0

    while (targetX !== 0) {
      if (!current.classList.contains('tempHidden')) targetX -= width
      if (targetX === 0) break

      if (current.nextSibling === null) break
      current = current.nextSibling
    }

    isSameRoot = false
  } else {
    currentX = parseInt(current.parentNode.style['transform'].match(/[\d]+/))
    current.classList.remove('highlight')
  }

  if (isSameRoot) {
    if (evt.target.dataset['cmd'] === 'right') {
      next = current.nextSibling

      if (hasHidden) while (next !== null && next.classList.contains('tempHidden')) next = next.nextSibling

      if (next === null) {
        next = childLists[0]
        while (next !== null && next.classList.contains('tempHidden')) next = next.nextSibling
        currentX = -width
      }
    } else {
      next = current.previousSibling
      if (hasHidden) while (next !== null && next.classList.contains('tempHidden')) next = next.previousSibling

      if (next === null) {
        next = childLists[childLists.length - 1]
        if (hasHidden) while (next !== null && next.classList.contains('tempHidden')) next = next.previousSibling

        currentX = ((childLists.length - hidden.length) * width)
      }
    }

    if (evt.target.dataset['cmd'] === 'right') currentX += width
    else currentX -= width
    next.parentNode.style['transform'] = 'translateX(-' + currentX.toString() + 'px)'

    current.style['opacity'] = '0'
    current.classList.remove('highlight')
    next.style['opacity'] = '1'
    next.classList.add('highlight')
    next.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = childLists.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, childLists.length - hidden.length])
  } else {
    current.style['opacity'] = '1'
    current.classList.add('highlight')
    current.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = childLists.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, childLists.length - hidden.length])
    current.parentNode.style['transform'] = 'translateX(-' + (currentX).toString() + 'px)'
  }

  let currentPage = document.querySelector('.page.active')
  if (currentPage.dataset['src'] === 'viewTopics') {
    activeNews = Math.floor(currentX / width)
  } else if (currentPage.dataset['src'] === 'viewFeeds') {
    activeFeedItem = Math.floor(currentX / width)
  }
}

function handleKeyUp (evt) {
  if (evt.target.nodeName === 'INPUT' || evt.target.nodeName === 'TEXTAREA') {
    return
  }

  if (inSingleRowMode && (evt.keyCode === 39 || (evt.keyCode === 9 && !evt.shiftKey))) {
    // Arrow right
    evt.preventDefault()

    let currentPage = document.querySelector('.page.active')
    let titleElements = currentPage.querySelectorAll('a.entryTitle')

    let current = evt.target.parentNode.parentNode.querySelector('.highlight')
    let indexStart = 0
    for (let element of titleElements) {
      if (current === element.parentNode) break
      ++indexStart
    }

    current.parentNode.classList.remove('highlight')

    let previousIndex = indexStart
    ++indexStart

    let currentX = 0

    if (titleElements[indexStart] === undefined) {
      indexStart = 0
      currentX = parseInt(titleElements[indexStart].parentNode.parentNode.style['transform'].match(/[\d]+/))
    } else currentX = parseInt(titleElements[indexStart].parentNode.parentNode.style['transform'].match(/[\d]+/))

    if (titleElements[previousIndex] !== undefined) titleElements[previousIndex].parentNode.classList.remove('highlight')

    let hasHidden = titleElements[indexStart].parentNode.parentNode.querySelector('.tempHidden') !== null
    let width = parseInt(titleElements[indexStart].parentNode.style['width'])
    currentX += width

    if (hasHidden) {
      let newIndex = indexStart

      while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) ++newIndex
      indexStart = newIndex

      if (titleElements[indexStart] === undefined) {
        currentX = 0
        newIndex = 0
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) ++newIndex
        indexStart = newIndex
      }

      let hidden = titleElements[indexStart].parentNode.parentNode.querySelectorAll('.tempHidden')
      newIndex = previousIndex

      if (titleElements[newIndex] !== undefined) {
        titleElements[newIndex].parentNode.classList.remove('highlight')
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) --newIndex
        if (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.parentNode.offsetTop === titleElements[indexStart].parentNode.parentNode.offsetTop) titleElements[newIndex].parentNode.style['opacity'] = '0'

        newIndex = previousIndex
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) ++newIndex
        if (titleElements[newIndex] !== undefined) titleElements[newIndex].parentNode.style['opacity'] = '0'
      }

      if (titleElements[previousIndex] !== undefined && titleElements[previousIndex].parentNode.parentNode.offsetTop !== titleElements[indexStart].parentNode.parentNode.offsetTop) {
        currentX = 0
        titleElements[previousIndex].parentNode.style['opacity'] = '1'
      }

      titleElements[indexStart].parentNode.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = titleElements[indexStart].parentNode.parentNode.children.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, titleElements[indexStart].parentNode.parentNode.children.length - hidden.length])
    } else {
      if (titleElements[indexStart + 1] !== undefined) {
        titleElements[indexStart + 1].parentNode.classList.remove('highlight')
        titleElements[indexStart + 1].parentNode.style['opacity'] = '0'
      }

      if (indexStart > 0) {
        titleElements[indexStart - 1].parentNode.classList.remove('highlight')
        titleElements[indexStart - 1].parentNode.style['opacity'] = '0'
      }

      if (titleElements[previousIndex] !== undefined && titleElements[previousIndex].parentNode.parentNode.offsetTop !== titleElements[indexStart].parentNode.parentNode.offsetTop) {
        titleElements[previousIndex].parentNode.style['opacity'] = '1'
        currentX = 0
      }

      titleElements[indexStart].parentNode.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = titleElements[indexStart].parentNode.parentNode.children.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, titleElements[indexStart].parentNode.parentNode.children.length])
    }

    titleElements[indexStart].parentNode.classList.add('highlight')
    titleElements[indexStart].parentNode.style['opacity'] = '1'
    titleElements[indexStart].parentNode.parentNode.style['transform'] = 'translateX(-' + currentX.toString() + 'px)'
    titleElements[indexStart].parentNode.focus()

    currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.425))

    if (currentPage.dataset['src'] === 'viewTopics') activeNews = indexStart
    else activeFeedItem = indexStart
    return
  } else if (inSingleRowMode && (evt.keyCode === 37 || (evt.keyCode === 9 && evt.shiftKey))) {
    // Arrow left
    evt.preventDefault()

    let currentPage = document.querySelector('.page.active')
    let titleElements = currentPage.querySelectorAll('a.entryTitle')

    let current = evt.target.parentNode.parentNode.querySelector('.highlight')
    let indexStart = 0
    for (let element of titleElements) {
      if (current === element.parentNode) break
      ++indexStart
    }

    current.parentNode.classList.remove('highlight')

    let previousIndex = indexStart
    --indexStart

    if (titleElements[indexStart] === undefined) indexStart = titleElements.length - 1

    let hasHidden = titleElements[indexStart].parentNode.parentNode.querySelector('.tempHidden') !== null
    let currentX = parseInt(titleElements[indexStart].parentNode.parentNode.style['transform'].match(/[\d]+/))
    let width = parseInt(titleElements[indexStart].parentNode.style['width'])

    currentX -= width

    if (hasHidden) {
      let newIndex = indexStart

      while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) --newIndex
      indexStart = newIndex

      if (titleElements[indexStart] === undefined) {
        newIndex = titleElements.length - 1
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) --newIndex
        indexStart = newIndex
      }

      let hidden = titleElements[indexStart].parentNode.parentNode.querySelectorAll('.tempHidden')
      newIndex = previousIndex

      if (titleElements[newIndex] !== undefined) {
        titleElements[newIndex].parentNode.classList.remove('highlight')
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) --newIndex
        if (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.parentNode.offsetTop === titleElements[indexStart].parentNode.parentNode.offsetTop) titleElements[newIndex].parentNode.style['opacity'] = '0'

        newIndex = previousIndex
        while (titleElements[newIndex] !== undefined && titleElements[newIndex].parentNode.classList.contains('tempHidden')) ++newIndex
        if (titleElements[newIndex] !== undefined) titleElements[newIndex].parentNode.style['opacity'] = '0'
      }

      if (titleElements[previousIndex] !== undefined && titleElements[previousIndex].parentNode.parentNode.offsetTop !== titleElements[indexStart].parentNode.parentNode.offsetTop) {
        currentX = (titleElements[indexStart].parentNode.parentNode.children.length - hidden.length - 1) * width
        titleElements[previousIndex].parentNode.style['opacity'] = '1'
      }

      titleElements[indexStart].parentNode.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = titleElements[indexStart].parentNode.parentNode.children.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, titleElements[indexStart].parentNode.parentNode.children.length - hidden.length])
    } else {
      if (titleElements[indexStart + 1] !== undefined) {
        titleElements[indexStart + 1].parentNode.classList.remove('highlight')
        titleElements[indexStart + 1].parentNode.style['opacity'] = '0'
      }

      if (indexStart > 0) {
        titleElements[indexStart - 1].parentNode.classList.remove('highlight')
        titleElements[indexStart - 1].parentNode.style['opacity'] = '0'
      }

      if (titleElements[previousIndex] !== undefined && titleElements[previousIndex].parentNode.parentNode.offsetTop !== titleElements[indexStart].parentNode.parentNode.offsetTop) {
        currentX = (titleElements[indexStart].parentNode.parentNode.children.length - 1) * width
        titleElements[previousIndex].parentNode.style['opacity'] = '1'
      }

      titleElements[indexStart].parentNode.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = titleElements[indexStart].parentNode.parentNode.children.length === 1 ? getMsg('itemCountSingular', [1, 1]) : getMsg('itemCountPlural', [Math.floor(currentX / width) + 1, titleElements[indexStart].parentNode.parentNode.children.length])
    }

    titleElements[indexStart].parentNode.classList.add('highlight')
    titleElements[indexStart].parentNode.style['opacity'] = '1'
    titleElements[indexStart].parentNode.parentNode.style['transform'] = 'translateX(-' + currentX.toString() + 'px)'
    titleElements[indexStart].parentNode.focus()

    currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.425))

    if (currentPage.dataset['src'] === 'viewTopics') activeNews = indexStart
    else activeFeedItem = indexStart
    return
  }

  if (!inSingleRowMode && evt.altKey) {
    // Alt key pressed
    let currentPage = document.querySelector('.page.active')
    let titleElements = currentPage.querySelectorAll('a.entryTitle')

    let indexStart = 0
    let current = currentPage.querySelector('.highlight a.entryTitle')
    let hidden = currentPage.parentNode.querySelectorAll('.tempHidden')
    let hasHidden = hidden !== null

    if (current === null) {
      indexStart = 0
      if (hasHidden) while (titleElements[indexStart] !== undefined && titleElements[indexStart].parentNode.classList.contains('tempHidden')) ++indexStart
      current = titleElements[indexStart]
    } else {
      current.parentNode.classList.remove('highlight')
      for (let element of titleElements) {
        if (current === element) break
        ++indexStart
      }
    }


    if (evt.keyCode === 38) {
      // arrow up
      evt.preventDefault()
      if (indexStart >= 0) titleElements[indexStart].parentNode.classList.remove('highlight')

      --indexStart
      if (hasHidden) while (titleElements[indexStart] !== undefined && titleElements[indexStart].parentNode.classList.contains('tempHidden')) --indexStart

      if (indexStart < 0) indexStart = titleElements.length - 1
      if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
        titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
        setTimeout(function () {
          titleElements[indexStart].parentNode.classList.add('highlight')
          titleElements[indexStart].parentNode.focus()
          currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.425))
        }, 450)
      } else {
        titleElements[indexStart].parentNode.focus()
        titleElements[indexStart].parentNode.classList.add('highlight')
        currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.425))
      }
    } else if (evt.keyCode === 40) {
      // arrow down
      evt.preventDefault()
      if (indexStart >= 0) titleElements[indexStart].parentNode.classList.remove('highlight')
      ++indexStart

      if (hasHidden) while (titleElements[indexStart] !== undefined && titleElements[indexStart].parentNode.classList.contains('tempHidden')) ++indexStart

      if (indexStart > titleElements.length - 1) indexStart = 0
      if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
        titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
        setTimeout(function () {
          titleElements[indexStart].parentNode.focus()
          titleElements[indexStart].parentNode.classList.add('highlight')
          currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.425))
        }, 450)
      } else {
        titleElements[indexStart].parentNode.classList.add('highlight')
        titleElements[indexStart].parentNode.focus()
        currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.425))
      }
    }

    if (currentPage.dataset['src'] === 'viewTopics') activeNews = indexStart
    else activeFeedItem = indexStart
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleImages (evt) {
  browser.storage.local.get('addon').then(function (data) {
    if (evt.target.value === 'enabled') {
      data['addon']['images'] = 'enabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyImagesEnabled') })
    } else {
      data['addon']['images'] = 'disabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyImagesDisabled') })
    }

    browser.storage.local.set(data)
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleNotifications (evt) {
  browser.storage.local.get('addon').then(function (data) {
    if (evt.target.value === 'enabled') {
      data['addon']['notifications'] = 'enabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyNotificationsEnabled') })
    } else {
      data['addon']['notifications'] = 'disabled'
      // browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyNotificationsDisabled') })
    }

    browser.storage.local.set(data)
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleAnimations (evt) {
  browser.storage.local.get('addon').then(function (data) {
    if (evt.target.value === 'enabled') {
      data['addon']['animations'] = 'enabled'
      document.body.classList.remove('noAnim')
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsAnimationsTitle'), 'message': getMsg('optionsBodyAnimationsEnabled') })
    } else {
      document.body.classList.add('noAnim')
      data['addon']['animations'] = 'disabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'iconUrl': 'icons/thunderNote.svg', 'title': getMsg('optionsAnimationsTitle'), 'message': getMsg('optionsBodyAnimationsDisabled') })
    }

    browser.storage.local.set(data)
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function handleInput (evt) {
  switch (evt.target.dataset['cmd']) {
    case 'searchFeedData':
      let searchValue = evt.target.value.trim().toLowerCase()

      for (let hiddenElements of document.querySelectorAll('.page.active .tempHidden')) {
        hiddenElements.classList.remove('tempHidden')
        hiddenElements.style['opacity'] = '1'
      }

      if (inSingleRowMode) {
        for (let subList of document.querySelectorAll('.page.active .subList')) {
          subList.style['transform'] = 'translateX(0px)'
          subList.parentNode.querySelector('.singleNewsIndex').textContent = getMsg('itemCountPlural', [1, subList.children.length])
        }
      }

      activeFeedItem = 0
      activeNews = 0

      if (searchValue.length === 0) return

      let newsEntries = document.querySelectorAll('.page.active .newsEntry')

      for (let entry of newsEntries) {
        let hasVisibleEntries = false
        let hasHighlight = false
        for (let child of entry.children[2].children) {
          if (child.lastChild.textContent.toLowerCase().indexOf(searchValue) === -1) {
            child.classList.add('tempHidden')
            child.classList.remove('highlight')
          } else {
            hasVisibleEntries = true
            child.classList.remove('tempHidden')
            child.classList.remove('highlight')
            child.style['opacity'] = '1'
            if (!hasHighlight) {
              child.classList.add('highlight')
              hasHighlight = true
            }
          }
        }

        if (!hasVisibleEntries) entry.classList.add('tempHidden')
        else entry.classList.remove('tempHidden')
      }

      let titleElements = document.querySelectorAll('.page.active .highlight a.entryTitle')
      let hasRemovedHighlight = false
      for (let element of titleElements) {
        let offset = element.parentNode.parentNode.querySelectorAll('.tempHidden').length
        if (inSingleRowMode) {
          element.parentNode.parentNode.parentNode.querySelector('.singleNewsIndex').textContent = getMsg('itemCountPlural', [1, element.parentNode.parentNode.children.length - offset])
          element.parentNode.parentNode.style['transform'] = 'translateX(0px)'
        }

        if (hasRemovedHighlight) element.parentNode.classList.remove('highlight')
        else {
          let startIndex = 0

          for (let entry of document.querySelectorAll('.page.active a.entryTitle')) {
            if (entry === element) break
            ++startIndex
          }

          element.parentNode.focus()
          activeFeedItem = startIndex
          activeNews = activeFeedItem
        }

        hasRemovedHighlight = true
      }

      break
    default:
      break
  }
}

// --------------------------------------------------------------------------------------------------------------------------------

for (let controlButton of document.querySelectorAll('.controlButton')) controlButton.addEventListener('click', handleButtons)
for (let controlInput of document.querySelectorAll('.controlInput')) controlInput.addEventListener('keyup', handleInput)
for (let backButton of document.querySelectorAll('.backButton')) backButton.addEventListener('click', handleButtons)

document.querySelector('.controlButton[data-cmd="removeFeed"]').addEventListener('click', removeFeed)
document.querySelector('.controlButton[data-cmd="forceUpdate"]').addEventListener('click', forceUpdate)
document.querySelector('.controlButton[data-cmd="forceUpdateAll"]').addEventListener('click', forceUpdateAll)

document.querySelector('#setThunderNoteState').addEventListener('change', toggleThunderNodeState)
document.querySelector('#switchImages').addEventListener('change', toggleImages)
document.querySelector('#switchNotifications').addEventListener('change', toggleNotifications)
document.querySelector('#switchAnimations').addEventListener('change', toggleAnimations)

document.querySelector('#addKeywordInput').addEventListener('keyup', addInputKeyword)

window.addEventListener('resize', queryResize)
browser.runtime.onMessage.addListener(handleMessage)

// --------------------------------------------------------------------------------------------------------------------------------
let inSingleRowMode = false
let inHeaderOnlyMode = false
let highlightKey = null

const dayLength = 24 * 3600 * 1000.0

let domNodes = document.querySelectorAll('*')
for (let item of domNodes) item.setAttribute('tabindex', -1)

// --------------------------------------------------------------------------------------------------------------------------------

browser.storage.local.get().then(function (data) {
  if (data['addon'] === undefined) data['addon'] = {}
  if (data['addon']['images'] === undefined) data['addon']['images'] = 'enabled'
  if (data['addon']['notifications'] === undefined) data['addon']['notifications'] = 'enabled'
  if (data['addon']['animations'] === undefined) data['addon']['animations'] = 'enabled'
  if (data['addon']['status'] === undefined) data['addon']['status'] = 'enabled'

  if (data['addon']['images'] === 'enabled') document.querySelector('#switchImages').value = 'enabled'
  if (data['addon']['animations'] === 'enabled') document.querySelector('#switchAnimations').value = 'enabled'
  if (data['addon']['notifications'] === 'enabled') document.querySelector('#switchNotifications').value = 'enabled'
  if (data['addon']['status'] === 'enabled') document.querySelector('#setThunderNoteState').value = 'enabled'

  if (data['addon']['animations'] !== 'enabled') document.body.classList.add('noAnim')

  browser.storage.local.set(data)
})
