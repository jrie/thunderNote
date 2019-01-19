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

function setFocus (element) {
  setTimeout(function () { document.querySelector(element).focus() }, 700)
}

// --------------------------------------------------------------------------------------------------------------------------------
let inSingleRowMode = false

function handleButtons (evt) {
  if (evt.target.dataset['cmd'] === 'switchSingleRow') {
    inSingleRowMode = !inSingleRowMode
    let activePage = document.querySelector('.page.active')
    if (activePage.dataset['src'] === 'viewTopics') fillTopics()
    else if (activePage.dataset['src'] === 'viewFeeds') fillViews()
    return
  }

  document.querySelector('.headerControl').classList.remove('inactive')

  for (let page of document.querySelectorAll('.page')) page.classList.remove('active')

  let addButton = document.querySelector('.controlButton[data-cmd="add"]')
  let removalButton = document.querySelector('.controlButton[data-cmd="removeFeed"]')
  let forceUpdateButton = document.querySelector('.controlButton[data-cmd="forceUpdate"]')

  if (evt.target.dataset['cmd'] !== 'removeFeed' || evt.target.dataset['cmd'] !== 'addItem') for (let item of document.querySelectorAll('.inititalHidden')) item.classList.add('hidden')

  document.removeEventListener('keyup', handleKeyUp)
  activeNews = -1
  activeFeedItem = -1

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
      activeNews = -1
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      document.addEventListener('keyup', handleKeyUp)
      for (let item of document.querySelectorAll('a.entryTitle')) item.addEventListener('focus', function (evt) { activeNews = evt.target.dataset['index'] })
      break
    case 'viewFeeds':
      fillViews()
      activeFeedItem = -1
      document.querySelector('.headerControl').classList.add('inactive')
      document.querySelector('.page[data-src="' + evt.target.dataset['cmd'] + '"').classList.add('active')
      focusNode = '.page[data-src="' + evt.target.dataset['cmd'] + '"'
      document.addEventListener('keyup', handleKeyUp)
      for (let item of document.querySelectorAll('a.entryTitle')) item.addEventListener('focus', function (evt) { activeNews = evt.target.dataset['index'] })
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
      browser.storage.local.set(data).then(fillURIs, errorHandle)
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
        browser.alarms.create(feedURI, { 'when': Date.now() + 250, 'periodInMinutes': data['feeds'][feedURI][1] })
      }
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function forceUpdateAll (evt) {
  browser.storage.local.get('feeds').then(function (data) {
    if (data['feeds'] !== undefined) {
      browser.alarms.clearAll()
      for (let feedURI of Object.keys(data['feeds'])) {
        browser.alarms.create(feedURI, { 'when': Date.now() + 250, 'periodInMinutes': data['feeds'][feedURI][1] })
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
    let newsIndex = 0

    let imagesAllowed = data['addon']['images'] === 'enabled'

    for (let feedURI of sortedFeeds) {
      let fold = document.createElement('button')
      let li = document.createElement('li')
      if (inSingleRowMode) li.className = 'newsEntry singleRow'
      else li.className = 'newsEntry'

      if (ul.children.length > 0) li.classList.add('folded')

      fold.className = 'folding'
      fold.innerHTML = '&laquo;'
      if (ul.children.length === 0) fold.innerHTML = '&raquo;'

      fold.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.style['opacity'] = 1
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '12px'
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.clientHeight - 30) + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&laquo'
          evt.target.parentNode.lastElementChild.style['opacity'] = 0
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '10px'
        }
      })

      let foldBottom = document.createElement('button')
      foldBottom.className = 'folding bottom'
      foldBottom.innerHTML = fold.innerHTML

      if (ul.children.length > 0) {
        foldBottom.style['opacity'] = 0
        foldBottom.style['margin-bottom'] = '-30px'
      }

      foldBottom.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.firstElementChild.innerHTML = '&raquo;'
          evt.target.style['opacity'] = 1
          evt.target.style['margin-bottom'] = '12px'
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.clientHeight - 30) + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.firstElementChild.innerHTML = '&laquo;'
          evt.target.style['opacity'] = 0
          evt.target.style['margin-bottom'] = '12px'
        }
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
      for (let newsItem of Object.keys(data['feedData'][feedURI])) {
        let feedMaxAge = data['feeds'][feedURI][2]
        if (feedMaxAge === 0) continue

        let age = Math.floor((now - newsItem[1]) / dayLength)
        if (age >= feedMaxAge) {
          delete data['feedData'][feedURI][newsItem]
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
          entryTitle.dataset['index'] = newsIndex++

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
      }
      li.appendChild(foldBottom)
      ul.appendChild(li)
      if (ul.children.length > 1) li.children[2].style['margin-bottom'] = (-li.clientHeight - 60) + 'px'
    }

    if (inSingleRowMode) queryResize()
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

      if (ul.children.length > 0) li.classList.add('folded')

      fold.className = 'folding'
      fold.innerHTML = '&laquo;'
      if (ul.children.length === 0) fold.innerHTML = '&raquo;'

      fold.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&raquo;'
          evt.target.parentNode.lastElementChild.style['opacity'] = 1
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '12px'
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.clientHeight - 60) + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.lastElementChild.innerHTML = '&laquo'
          evt.target.parentNode.lastElementChild.style['opacity'] = 0
          evt.target.parentNode.lastElementChild.style['margin-bottom'] = '-30px'
        }
      })

      let foldBottom = document.createElement('button')
      foldBottom.className = 'folding bottom'
      foldBottom.innerHTML = fold.innerHTML

      if (ul.children.length > 0) {
        foldBottom.style['opacity'] = 0
        foldBottom.style['margin-bottom'] = '-30px'
      }

      foldBottom.addEventListener('click', function (evt) {
        if (evt.target.parentNode.classList.contains('folded')) {
          evt.target.parentNode.children[2].style['margin-bottom'] = '12px'
          evt.target.parentNode.classList.remove('folded')
          evt.target.innerHTML = '&raquo;'
          evt.target.parentNode.firstElementChild.innerHTML = '&raquo;'
          evt.target.style['opacity'] = 1
          evt.target.style['margin-bottom'] = '12px'
        } else {
          evt.target.parentNode.classList.add('folded')
          evt.target.parentNode.children[2].style['margin-bottom'] = (-evt.target.parentNode.clientHeight - 60) + 'px'
          evt.target.innerHTML = '&laquo;'
          evt.target.parentNode.firstElementChild.innerHTML = '&laquo;'
          evt.target.style['opacity'] = 0
          evt.target.style['margin-bottom'] = '-30px'
        }
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
              entryTitle.dataset['index'] = newsIndex++

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
      }
      li.appendChild(foldBottom)
      ul.appendChild(li)

      if (ul.children.length > 1) li.children[2].style['margin-bottom'] = (-li.clientHeight - 60) + 'px'
    }

    if (inSingleRowMode) queryResize()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function queryResize (evt) {
  if (inSingleRowMode) {
    let inititialWidth = parseInt(document.querySelector('body').children[1].clientWidth * 0.9) - 1
    for (let subList of document.querySelectorAll('.page.active .subList')) {
      subList.style['width'] = inititialWidth * (subList.children.length) + 'px'
      subList.style['overflow'] = 'hidden'
      subList.style['transform'] = 'translateX(0px)'
      subList.style['opacity'] = '1'

      let num = 0
      for (let element of subList.children) {
        element.dataset['x'] = inititialWidth * num++
        element.dataset['max'] = inititialWidth * (subList.children.length - 1)
        element.style['width'] = inititialWidth + 'px'
        element.style['float'] = 'left'
      }
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
    fillKeywords()
    browser.storage.local.get('addon').then(function (data) {
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', message['addKeyword']) })
    })
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
    if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('addKeywordTitle'), 'message': getMsg('addKeywordBody', keywordText) })
    evt.target.value = ''
    evt.target.focus()
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleThunderNodeState (evt) {
  browser.storage.local.get().then(function (data) {
    data['addon'] = { 'status': evt.target.value }
    browser.storage.local.set(data)

    if (!isEnabled()) {
      browser.alarms.clearAll()
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteDisabled') })
    } else {
      if (data['feeds'] !== undefined) {
        for (let url of Object.keys(data['feeds'])) browser.alarms.create(url, { 'when': Date.now() + 250, 'periodInMinutes': data['feeds'][url][1] })
      }

      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('thunderNoteStatusTitle'), 'message': getMsg('thunderNoteEnabled') })
    }
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------
let activeNews = -1
let activeFeedItem = -1

function handleKeyUp (evt) {
  if (evt.target.nodeName === 'INPUT' || evt.target.nodeName === 'TEXTAREA') return

  if (inSingleRowMode && evt.keyCode === 39) {
    // Arrow right
    let currentPage = document.querySelector('.page.active')
    let titleElements
    let indexStart = -1

    if (currentPage.dataset['src'] === 'viewTopics') {
      titleElements = document.querySelectorAll('#viewTopics a.entryTitle')
      indexStart = activeNews
    } else {
      titleElements = document.querySelectorAll('#viewFeeds a.entryTitle')
      indexStart = activeFeedItem
    }

    evt.preventDefault()
    if (indexStart >= 0) {
      titleElements[indexStart].parentNode.classList.remove('highlight')
      if (parseInt(titleElements[indexStart].parentNode.dataset['x']) !== 0 && parseInt(titleElements[indexStart].parentNode.dataset['x']) !== parseInt(titleElements[indexStart].parentNode.dataset['max'])) {
        titleElements[indexStart].parentNode.style['opacity'] = '0'
      }
    }
    ++indexStart

    if (indexStart > titleElements.length - 1) indexStart = 0

    titleElements[indexStart].parentNode.parentNode.style['transform'] = 'translateX(-' + titleElements[indexStart].parentNode.dataset['x'] + 'px)'
    titleElements[indexStart].parentNode.style['opacity'] = '1'

    if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
      titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
      setTimeout(function () {
        currentPage = document.querySelector('.page.active')

        titleElements[indexStart].parentNode.focus()
        titleElements[indexStart].parentNode.classList.add('highlight')
        currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.5))
      }, 450)
    } else {
      titleElements[indexStart].parentNode.classList.add('highlight')
      titleElements[indexStart].parentNode.focus()
      currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.5))
    }

    if (currentPage.dataset['src'] === 'viewTopics') activeNews = indexStart
    else activeFeedItem = indexStart
    return
  } else if (inSingleRowMode && evt.keyCode === 37) {
    // Arrow left
    let currentPage = document.querySelector('.page.active')
    let titleElements
    let indexStart = -1

    if (currentPage.dataset['src'] === 'viewTopics') {
      titleElements = document.querySelectorAll('#viewTopics a.entryTitle')
      indexStart = activeNews
    } else {
      titleElements = document.querySelectorAll('#viewFeeds a.entryTitle')
      indexStart = activeFeedItem
    }

    evt.preventDefault()
    if (indexStart >= 0) {
      titleElements[indexStart].parentNode.classList.remove('highlight')
      if (parseInt(titleElements[indexStart].parentNode.dataset['x']) !== 0 && parseInt(titleElements[indexStart].parentNode.dataset['x']) !== parseInt(titleElements[indexStart].parentNode.dataset['max'])) {
        titleElements[indexStart].parentNode.style['opacity'] = '0'
      }
    }
    --indexStart

    if (indexStart < 0) indexStart = titleElements.length - 1
    titleElements[indexStart].parentNode.parentNode.style['transform'] = 'translateX(-' + titleElements[indexStart].parentNode.dataset['x'] + 'px)'
    titleElements[indexStart].parentNode.style['opacity'] = '1'

    if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
      titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
      setTimeout(function () {
        titleElements[indexStart].parentNode.classList.add('highlight')
        titleElements[indexStart].parentNode.focus()
        currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.5))
      }, 450)
    } else {
      titleElements[indexStart].parentNode.focus()
      titleElements[indexStart].parentNode.classList.add('highlight')
      currentPage.scrollTo(0, titleElements[indexStart].parentNode.parentNode.offsetTop - (window.innerHeight * 0.5))
    }

    if (currentPage.dataset['src'] === 'viewTopics') activeNews = indexStart
    else activeFeedItem = indexStart
    return
  }

  if (!inSingleRowMode && evt.altKey) {
    // Alt key pressed
    let currentPage = document.querySelector('.page.active')
    let titleElements
    let indexStart = -1

    if (currentPage.dataset['src'] === 'viewTopics') {
      titleElements = document.querySelectorAll('#viewTopics a.entryTitle')
      indexStart = activeNews
    } else {
      titleElements = document.querySelectorAll('#viewFeeds a.entryTitle')
      indexStart = activeFeedItem
    }

    if (evt.keyCode === 38) {
      // arrow up
      evt.preventDefault()
      if (indexStart >= 0) titleElements[indexStart].parentNode.classList.remove('highlight')
      --indexStart
      if (indexStart < 0) indexStart = titleElements.length - 1
      if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
        titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
        setTimeout(function () {
          titleElements[indexStart].parentNode.classList.add('highlight')
          titleElements[indexStart].parentNode.focus()
          currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.5))
        }, 450)
      } else {
        titleElements[indexStart].parentNode.focus()
        titleElements[indexStart].parentNode.classList.add('highlight')
        currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.5))
      }
    } else if (evt.keyCode === 40) {
      // arrow down
      evt.preventDefault()
      if (indexStart >= 0) titleElements[indexStart].parentNode.classList.remove('highlight')

      ++indexStart

      if (indexStart > titleElements.length - 1) indexStart = 0
      if (titleElements[indexStart].parentNode.parentNode.parentNode.classList.contains('folded')) {
        titleElements[indexStart].parentNode.parentNode.parentNode.firstElementChild.click()
        setTimeout(function () {
          titleElements[indexStart].parentNode.focus()
          titleElements[indexStart].parentNode.classList.add('highlight')
          currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.225))
        }, 450)
      } else {
        titleElements[indexStart].parentNode.classList.add('highlight')
        titleElements[indexStart].parentNode.focus()
        currentPage.scrollTo(0, titleElements[indexStart].offsetTop - (window.innerHeight * 0.225))
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
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyImagesEnabled') })
    } else {
      data['addon']['images'] = 'disabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyImagesDisabled') })
    }

    browser.storage.local.set(data)
  }, errorHandle)
}

// --------------------------------------------------------------------------------------------------------------------------------

function toggleNotifications (evt) {
  browser.storage.local.get('addon').then(function (data) {
    if (evt.target.value === 'enabled') {
      data['addon']['notifications'] = 'enabled'
      if (data['addon']['notifications'] === 'enabled') browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyNotificationsEnabled') })
    } else {
      data['addon']['notifications'] = 'disabled'
      // browser.notifications.create(null, { 'type': 'basic', 'title': getMsg('optionsNotificationTitle'), 'message': getMsg('optionsBodyNotificationsDisabled') })
    }

    browser.storage.local.set(data)
  }, errorHandle)
}
// --------------------------------------------------------------------------------------------------------------------------------

for (let controlButton of document.querySelectorAll('.controlButton')) controlButton.addEventListener('click', handleButtons)
for (let backButton of document.querySelectorAll('.backButton')) backButton.addEventListener('click', handleButtons)

document.querySelector('.controlButton[data-cmd="removeFeed"]').addEventListener('click', removeFeed)
document.querySelector('.controlButton[data-cmd="forceUpdate"]').addEventListener('click', forceUpdate)
document.querySelector('.controlButton[data-cmd="forceUpdateAll"]').addEventListener('click', forceUpdateAll)
document.querySelector('#setThunderNoteState').addEventListener('change', toggleThunderNodeState)

document.querySelector('#switchImages').addEventListener('change', toggleImages)
document.querySelector('#switchNotifications').addEventListener('change', toggleNotifications)

document.querySelector('#addKeywordInput').addEventListener('keyup', addInputKeyword)

window.addEventListener('resize', queryResize)
browser.runtime.onMessage.addListener(handleMessage)

// --------------------------------------------------------------------------------------------------------------------------------
const dayLength = 24 * 3600 * 1000.0

fillKeywords()
fillTopics()

let domNodes = document.querySelectorAll('*')
for (let item of domNodes) item.setAttribute('tabindex', -1)

// --------------------------------------------------------------------------------------------------------------------------------

browser.storage.local.get().then(function (data) {
  if (data['addon'] === undefined) data['addon'] = {}
  if (data['addon']['images'] === undefined) data['addon']['images'] = 'enabled'
  if (data['addon']['notifications'] === undefined) data['addon']['notifications'] = 'enabled'
  if (data['addon']['status'] === undefined) data['addon']['status'] = 'enabled'

  if (data['addon']['images'] === 'enabled') document.querySelector('#switchImages').value = 'enabled'
  if (data['addon']['notifications'] === 'enabled') document.querySelector('#switchNotifications').value = 'enabled'
  if (data['addon']['status'] === 'enabled') document.querySelector('#setThunderNoteState').value = 'enabled'

  browser.storage.local.set(data)
})
