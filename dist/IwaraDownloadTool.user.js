// ==UserScript==
// @name              Iwara Download Tool
// @description       Download videos from iwara.tv
// @name:ja           Iwara バッチダウンローダー
// @description:ja    Iwara 動画バッチをダウンロード
// @name:zh-CN        Iwara 批量下载工具
// @description:zh-CN 批量下载 Iwara 视频
// @icon              https://i.harem-battle.club/images/2023/03/21/wMQ.png
// @namespace         https://github.com/dawn-lc/user.js
// @version           3.0.59
// @author            dawn-lc
// @license           Apache-2.0
// @copyright         2023, Dawnlc (https://dawnlc.me/)
// @source            https://github.com/dawn-lc/user.js
// @supportURL        https://github.com/dawn-lc/user.js/issues
// @updateURL         https://github.com/dawn-lc/user.js/raw/master/dist/IwaraDownloadTool.mata.js
// @downloadURL       https://github.com/dawn-lc/user.js/raw/master/dist/IwaraDownloadTool.user.js
// @connect           *
// @match             *://*.iwara.tv/*
// @grant             GM_getValue
// @grant             GM_setValue
// @grant             GM_listValues
// @grant             GM_deleteValue
// @grant             GM_addValueChangeListener
// @grant             GM_removeValueChangeListener
// @grant             GM_addStyle
// @grant             GM_getResourceText
// @grant             GM_download
// @grant             GM_xmlhttpRequest
// @grant             GM_openInTab
// @grant             GM_cookie
// @grant             unsafeWindow
// @run-at            document-start
// ==/UserScript==
(async function () {
    /**
     * RenderCode 转换成 Node
     * @param renderCode - RenderCode
     * @returns Node 节点
     */
    const renderNode = function (renderCode) {
        if (typeof renderCode === "string") {
            return document.createTextNode(renderCode);
        }
        if (renderCode instanceof Node) {
            return renderCode;
        }
        if (typeof renderCode !== "object" || !renderCode.nodeType) {
            throw new Error('Invalid arguments');
        }
        const { nodeType, attributes, events, className, childs } = renderCode;
        const node = document.createElement(nodeType);
        (attributes !== undefined && attributes !== null && Object.keys(attributes).length !== 0) && Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        (events !== undefined && events !== null && Object.keys(events).length > 0) && Object.entries(events).forEach(([eventName, eventHandler]) => node.addEventListener(eventName, eventHandler));
        (className !== undefined && className !== null && className.length > 0) && node.classList.add(...[].concat(className));
        (childs !== undefined && childs !== null) && node.append(...[].concat(childs).map(renderNode));
        return node;
    };
    class Queue {
        items;
        constructor() {
            this.items = [];
        }
        enqueue(id, element) {
            this.items.push({ id, data: element });
        }
        dequeue() {
            return this.items.shift();
        }
        peek() {
            return this.items[0];
        }
        size() {
            return this.items.length;
        }
        isEmpty() {
            return this.items.length === 0;
        }
        clear() {
            this.items = [];
        }
        remove(id) {
            const index = this.items.findIndex(item => item.id === id);
            if (index !== -1) {
                this.items.splice(index, 1);
            }
        }
    }
    class Dictionary {
        items;
        constructor() {
            this.items = {};
        }
        set(key, value) {
            this.items[key] = value;
        }
        get(key) {
            return this.has(key) ? this.items[key] : undefined;
        }
        has(key) {
            return this.items.hasOwnProperty(key);
        }
        remove(key) {
            if (this.has(key)) {
                delete this.items[key];
                return true;
            }
            return false;
        }
        get size() {
            return Object.keys(this.items).length;
        }
        keys() {
            return Object.keys(this.items);
        }
        values() {
            return Object.values(this.items);
        }
        clear() {
            this.items = {};
        }
        forEach(callback) {
            for (let key in this.items) {
                if (this.has(key)) {
                    callback(key, this.items[key]);
                }
            }
        }
    }
    let DownloadType;
    (function (DownloadType) {
        DownloadType[DownloadType["aria2"] = 0] = "aria2";
        DownloadType[DownloadType["default"] = 1] = "default";
        DownloadType[DownloadType["iwaraDownloader"] = 2] = "iwaraDownloader";
        DownloadType[DownloadType["others"] = 3] = "others";
    })(DownloadType || (DownloadType = {}));
    let APIType;
    (function (APIType) {
        APIType[APIType["http"] = 0] = "http";
        APIType[APIType["ws"] = 1] = "ws";
        APIType[APIType["https"] = 2] = "https";
        APIType[APIType["wss"] = 3] = "wss";
    })(APIType || (APIType = {}));
    let TipsType;
    (function (TipsType) {
        TipsType[TipsType["Info"] = 0] = "Info";
        TipsType[TipsType["Warning"] = 1] = "Warning";
        TipsType[TipsType["Success"] = 2] = "Success";
        TipsType[TipsType["Progress"] = 3] = "Progress";
        TipsType[TipsType["Dialog"] = 4] = "Dialog";
    })(TipsType || (TipsType = {}));
    class Config {
        cookies;
        checkDownloadLink;
        downloadType;
        downloadPath;
        downloadProxy;
        aria2Type;
        aria2Path;
        aria2Token;
        iwaraDownloaderPath;
        iwaraDownloaderToken;
        constructor() {
            //初始化
            this.checkDownloadLink = GM_getValue('checkDownloadLink', true);
            this.downloadType = Number(GM_getValue('downloadType', DownloadType.others));
            this.downloadPath = GM_getValue('downloadPath', 'IwaraVideo/%#AUTHOR#%/%#TITLE#%[%#ID#%].mp4');
            this.downloadProxy = GM_getValue('downloadProxy', '');
            this.aria2Type = Number(GM_getValue('aria2Type', APIType.ws));
            this.aria2Path = GM_getValue('aria2Path', '127.0.0.1:6800');
            this.aria2Token = GM_getValue('aria2Token', '');
            this.iwaraDownloaderPath = GM_getValue('iwaraDownloaderPath', 'http://127.0.0.1:6800');
            this.iwaraDownloaderToken = GM_getValue('iwaraDownloaderToken', '');
            //代理本页面的更改
            let body = new Proxy(this, {
                get: function (target, property) {
                    console.log(`get ${property.toString()}`);
                    return target[property];
                },
                set: function (target, property, value) {
                    if (target[property] !== value) {
                        console.log(`set ${property.toString()} ${value}`);
                        GM_setValue(property.toString(), value);
                        return target[property] = value;
                    }
                }
            });
            GM_cookie('list', { domain: 'iwara.tv', httpOnly: true }, (list, error) => {
                if (error) {
                    console.log(error);
                }
                else {
                    body.cookies = list;
                }
            });
            //同步其他页面脚本的更改
            GM_listValues().forEach((value) => {
                GM_addValueChangeListener(value, (name, old_value, new_value, remote) => {
                    if (remote && body[name] !== new_value) {
                        body[name] = new_value;
                    }
                });
            });
            return body;
        }
    }
    class VideoInfo {
        Title;
        ID;
        UploadTime;
        Name;
        FileName;
        Tags;
        Author;
        Private;
        VideoInfoSource;
        VideoFileSource;
        State;
        getDownloadQuality;
        getDownloadUrl;
        getComment;
        constructor(Name) {
            this.Title = { nodeType: 'h2', childs: 'Iwara批量下载工具-解析模块' };
            this.Name = Name;
            return this;
        }
        async init(ID) {
            try {
                this.ID = ID;
                this.VideoInfoSource = JSON.parse(await get(`https://api.iwara.tv/video/${this.ID}`));
                if (this.VideoInfoSource.id === undefined) {
                    throw new Error('获取视频信息失败');
                }
                this.Name = this.VideoInfoSource.title ?? this.Name;
                this.Author = this.VideoInfoSource.user.username;
                this.Private = this.VideoInfoSource.private;
                this.UploadTime = new Date(this.VideoInfoSource.createdAt);
                this.Tags = this.VideoInfoSource.tags;
                this.FileName = this.VideoInfoSource.file.name;
                this.VideoFileSource = JSON.parse(await get(this.VideoInfoSource.fileUrl));
                if (this.VideoFileSource.length == 0) {
                    throw new Error('获取视频源失败');
                }
                this.getComment = () => {
                    return this.VideoInfoSource.body;
                };
                this.getDownloadQuality = () => {
                    let priority = {
                        'Source': 100,
                        '540': 2,
                        '360': 1
                    };
                    return this.VideoFileSource.sort((a, b) => priority[b.name] - priority[a.name])[0].name;
                };
                this.getDownloadUrl = () => {
                    let fileList = this.VideoFileSource.filter(x => x.name == this.getDownloadQuality());
                    return decodeURIComponent('https:' + fileList[Math.floor(Math.random() * fileList.length)].src.download);
                };
                this.State = true;
                return this;
            }
            catch (error) {
                console.log(this.VideoInfoSource);
                console.log(this.VideoFileSource);
                console.error(error);
                this.State = false;
                return this;
            }
        }
    }
    function parseSearchParams(searchParams, initialObject = {}) {
        return [...searchParams.entries()].reduce((acc, [key, value]) => ({ ...acc, [key]: value }), initialObject);
    }
    async function getXVersion(urlString) {
        let url = new URL(urlString);
        let params = parseSearchParams(url.searchParams);
        const data = new TextEncoder().encode(`${url.pathname.split("/").pop()}_${params['expires']}_5nFp9kmbNnHdAFhaqMvt`);
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }
    async function get(url, referrer = window.location.hostname, headers = {}) {
        if (url.split('//')[1].split('/')[0] == window.location.hostname) {
            return await (await fetch(url, {
                'headers': Object.assign({
                    'accept': 'application/json, text/plain, */*',
                    'x-version': await getXVersion(url)
                }, headers),
                "referrerPolicy": "strict-origin-when-cross-origin",
                'referrer': referrer,
                'method': 'GET',
                'mode': 'cors',
                'redirect': 'follow',
                'credentials': 'omit'
            })).text();
        }
        else {
            let data = await new Promise(async (resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: Object.assign({
                        'Accept': 'application/json, text/plain, */*',
                        'x-version': await getXVersion(url)
                    }, headers),
                    onload: function (response) {
                        resolve(response);
                    },
                    onerror: function (error) {
                        reject(error);
                    }
                });
            });
            return data.responseText;
        }
    }
    async function post(url, body, referrer = window.location.hostname, headers = {}) {
        if (typeof body !== 'string')
            body = JSON.stringify(body);
        if (url.split('//')[1].split('/')[0] == window.location.hostname) {
            return await (await fetch(url, {
                'headers': Object.assign({
                    'accept': 'application/json, text/plain, */*'
                }, headers),
                'referrer': referrer,
                'body': body,
                'method': 'POST',
                'mode': 'cors',
                'redirect': 'follow',
                'credentials': 'include'
            })).text();
        }
        else {
            let data = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: Object.assign({
                        'Accept': 'application/json, text/plain, */*',
                        'Content-Type': 'application/json'
                    }, headers),
                    data: body,
                    onload: function (response) {
                        resolve(response);
                    },
                    onerror: function (error) {
                        reject(error);
                    }
                });
            });
            return data.responseText;
        }
    }
    /**
      * 检查字符串中是否包含下载链接特征
      * @param {string} comment - 待检查的字符串
      * @returns {boolean} - 如果字符串中包含下载链接特征则返回 true，否则返回 false
      */
    function checkIsHaveDownloadLink(comment) {
        if (!config.checkDownloadLink) {
            return false;
        }
        if (comment == null) {
            return false;
        }
        const downloadLinkCharacteristics = [
            'pan\.baidu',
            'mega\.nz',
            'drive\.google\.com',
            'aliyundrive',
            'uploadgig',
            'katfile',
            'storex',
            'subyshare',
            'rapidgator',
            'filebe',
            'filespace',
            'mexa\.sh',
            'mexashare',
            'mx-sh\.net',
            'uploaded\.',
            'icerbox',
            'alfafile',
            'drv\.ms',
            'onedrive',
            'pixeldrain\.com',
            'gigafile\.nu'
        ];
        for (let index = 0; index < downloadLinkCharacteristics.length; index++) {
            if (comment.indexOf(downloadLinkCharacteristics[index]) != -1) {
                return true;
            }
        }
        return false;
    }
    async function AnalyzeDownloadTask() {
        for (const key in videoList.items) {
            console.log(key);
            let videoInfo = await (new VideoInfo(videoList[key])).init(key);
            videoInfo.State && pustDownloadTask(videoInfo);
        }
        document.querySelectorAll('.selectButton').forEach((element) => {
            let button = element;
            button.checked && button.click();
        });
        videoList.clear();
    }
    async function pustDownloadTask(videoInfo) {
        if (checkIsHaveDownloadLink(videoInfo.getComment())) {
            console.error("高画质" + videoInfo);
            return;
        }
        if (videoInfo.getDownloadQuality() != 'Source') {
            console.error("非原画" + videoInfo);
            return;
        }
        iwaraDownloaderDownload(videoInfo);
    }
    function iwaraDownloaderDownload(videoInfo) {
        (async function (ID, Author, Name, UploadTime, Info, Tag, DownloadUrl) {
            let json = Object.assign({
                'ver': 1,
                'code': 'add',
                'data': {
                    'Source': ID,
                    'author': Author,
                    'name': Name,
                    'downloadTime': new Date(),
                    'uploadTime': UploadTime,
                    'downloadUrl': DownloadUrl,
                    'downloadCookies': config.cookies,
                    'info': Info,
                    'tag': Tag
                }
            }, config.iwaraDownloaderToken.length != 0 ? { 'token': config.iwaraDownloaderToken } : {});
            console.log(json);
            let r = JSON.parse(await post(config.iwaraDownloaderPath, json));
            if (r.code == 0) {
                console.log("已推送" + ID);
            }
            else {
                console.log("推送失败" + ID);
            }
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.getComment(), videoInfo.Tags, videoInfo.getDownloadUrl()));
    }
    let config = new Config();
    let videoList = new Dictionary();
    /*
    const originFetch = fetch;
    const modifyFetch = (url: any, options: any) => {
        console.log("Fetch "+url)
        if (options.headers!==undefined){
            for (const key in options.headers) {
                if (key.toLocaleLowerCase() == "x-version"){
                    config.xVersion = options.headers[key]
                }
            }
        }
        return originFetch(url, options)
    }
    window.fetch = modifyFetch
    window.unsafeWindow.fetch = modifyFetch
    */
    let style = renderNode({
        nodeType: "style",
        childs: `
        #pluginMenu {
            z-index: 4096;
            position: fixed;
            top: 50%;
            right: 0px;
            padding: 10px;
            background-color: #565656;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px #ccc;
            transform: translate(85%, -50%);
            transition: transform 0.5s cubic-bezier(0.68, -0.24, 0.265, 1.20);
        }
        #pluginMenu ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        #pluginMenu li {
            padding: 5px 10px;
            cursor: pointer;
            text-align: center;
            user-select: none;
        }
        #pluginMenu li:hover {
            background-color: #000000cc;
        }

        #pluginMenu:hover {
            transform: translate(0%, -50%);
            transition-delay: 0.5s;
        }
    
        #pluginMenu:not(:hover) {
            transition-delay: 0s;
        }
    
        #pluginMenu.moving-out {
            transform: translate(0%, -50%);
        }
    
        #pluginMenu.moving-in {
            transform: translate(85%, -50%);
        }
    
        /* 以下为兼容性处理 */
        #pluginMenu:not(.moving-out):not(.moving-in) {
            transition-delay: 0s;
        }
    
        #pluginMenu:hover,
        #pluginMenu:hover ~ #pluginMenu {
            transition-delay: 0s;
        }
    
        #pluginMenu:hover {
            transition-duration: 0.5s;
        }
    
        #pluginMenu:not(:hover).moving-in {
            transition-delay: 0.5s;
        }

        .selectButton {
            position: absolute;
            width: 32px;
            height: 32px;
            bottom: 24px;
            right: 0px;
        }
        `
    });
    let UI = renderNode({
        nodeType: "div",
        attributes: {
            id: "pluginMenu"
        },
        childs: {
            nodeType: "ul",
            childs: [
                {
                    nodeType: "li",
                    childs: "开关选择",
                    events: {
                        click: () => {
                            if (!document.querySelector('.selectButton')) {
                                document.querySelectorAll('.page-videoList__item * .videoTeaser__thumbnail').forEach((element) => {
                                    element.appendChild(renderNode({
                                        nodeType: "input",
                                        attributes: {
                                            type: "checkbox"
                                        },
                                        className: 'selectButton',
                                        events: {
                                            input: (event) => {
                                                event.stopPropagation();
                                                return false;
                                            },
                                            click: (event) => {
                                                let target = event.target;
                                                let id = target.parentElement.getAttribute('href').trim().split('/')[2];
                                                let name = target.parentElement.parentElement.querySelector('.videoTeaser__title').getAttribute('title');
                                                target.checked ? videoList.set(id, name) : videoList.remove(id);
                                                event.stopPropagation();
                                                return false;
                                            }
                                        }
                                    }));
                                });
                            }
                            else {
                                document.querySelectorAll('.selectButton').forEach((element) => {
                                    element.remove();
                                });
                            }
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "下载所选",
                    events: {
                        click: (event) => {
                            AnalyzeDownloadTask();
                            event.stopPropagation();
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "全部选中",
                    events: {
                        click: (event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                let button = element;
                                !button.checked && button.click();
                            });
                            event.stopPropagation();
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "取消全选",
                    events: {
                        click: (event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                let button = element;
                                button.checked && button.click();
                            });
                            event.stopPropagation();
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "反向选中",
                    events: {
                        click: (event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                element.click();
                            });
                            event.stopPropagation();
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "打开设置",
                    events: {
                        click: (event) => {
                            event.stopPropagation();
                            return false;
                        }
                    }
                }
            ]
        }
    });
    document.head.appendChild(style);
    document.body.appendChild(UI);
    /*
        class pluginTips {
            WaitingQueue: Queue<DownloadTask>
            DownloadingQueue: Queue<DownloadTask>
            static Title: RenderCode = { nodeType: 'h2', childs: 'Iwara批量下载工具' }
            static typeIcon: object = {
                Info: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
                Warning: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                Success: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
                Progress: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>'
            }
            static Container: Element = renderNode({
                nodeType: 'section',
                attributes: {
                    id: 'PluginTips'
                },
                className: 'tipsContainer'
            }) as Element
            constructor() {
                this.DownloadingQueue = new Queue()
                this.WaitingQueue = new Queue()
                document.body.appendChild(pluginTips.Container);
            }
            downloadComplete(id: string) {
                this.DownloadingQueue.remove(id)
                pluginTips.Container.children.namedItem(id).remove()
                if (this.WaitingQueue.size() > 0) {
                    let downloadTask = this.WaitingQueue.dequeue()
                    if (GM_info.downloadMode == 'native') {
                        this.progress({
                            title: {
                                nodeType: 'h2',
                                childs: `${downloadTask.data.name} 下载中...`
                            },
                            id: downloadTask.id
                        })
                    } else {
                        this.info({
                            content: {
                                nodeType: 'p',
                                childs: `${downloadTask.data.name} 已开始下载!`
                            }
                        })
                    }
                    this.DownloadingQueue.enqueue(downloadTask.id,downloadTask.data)
                    GM_download(downloadTask.data)
                }
            }
            downloading(id: string, value: number) {
                let downloadTask = pluginTips.Container.children.namedItem(id).querySelector('.value') as HTMLElement
                downloadTask.setAttribute('value', value.toFixed(2))
                downloadTask.style.width = value.toFixed(2) + '%'
            }
            info(params: LogCode) {
                let code = params
                new tips(TipsType.Info, code.content, code.title, code.id, code.wait)
                console.info(code)
            }
            warning(params: LogCode) {
                let code = params
                new tips(TipsType.Warning, code.content, code.title, code.id, code.wait)
                console.warn(code)
            }
            success(params: LogCode) {
                let code = params
                new tips(TipsType.Success, code.content, code.title, code.id, code.wait)
                console.log(code)
            }
            progress(params: LogCode) {
                if (pluginTips.Container.children.namedItem(params.id as string) != null) {
                    this.warning({
                        content: {
                            nodeType: 'p',
                            childs: [
                                params.content,
                                '任务已存在。'
                            ]
                        }
                    })
                    return
                }
                new tips(TipsType.Progress, params.title, {
                    nodeType: 'div',
                    className: 'Progress',
                    childs: [{
                        nodeType: 'div',
                        className: 'value',
                        attributes: {
                            value: 0
                        }
                    }]
                }, params.id, true)
            }
            dialog(params: LogCode,) {
                let s  = {
                    childs: "取消下载",
                    events:{
                        click : () => {
                            pluginTips.Container.children.namedItem(params.id).remove()
                        }
                    }
                };
                params.content =
                {
                    nodeType: "div",
                    childs: [
                        params.content, {
                            nodeType: "button",
                            className: "btn-primary tipsButton"
                            
                        }, {
                            nodeType: "button",
                            className: "btn-primary tipsButton",
                            childs: "重新下载",
                            attributes: {
                                id: true
                            },
                            events:{
                                click : () => {
                                    //ParseDownloadAddress(params.id, false)
                                    pluginTips.Container.children.namedItem(params.id).remove()
                                }
                            }
                        }
                    ]
                }
                new tips(TipsType.Dialog, params.content, params.title, params.id, true, TipsType.Warning)
            }
        }
        class tips {
            id: String;
            type: TipsType
            show: TipsType
            wait: boolean
            constructor(type: TipsType, content: RenderCode, title: RenderCode, id: String = null, wait: boolean = false, show: TipsType = null) {
                this.type = type
                this.show = show ??= type
                this.wait = wait
                switch (this.type) {
                    case TipsType.Progress:
                        //todo 取消任务
                        break;
                    case TipsType.Dialog:
                        //todo 确认框
                        break;
                    default:
                        break;
                }
                renderNode(Object.assign({
                    nodeType: 'div',
                    childs: [{
                        nodeType: 'div',
                        className: 'tipsIcon',
                        childs: getRenderCode(pluginTips.typeIcon[TipsType[show]])
                    }, {
                        nodeType: 'div',
                        className: 'tipsContent',
                        childs: [title ?? pluginTips.Title].concat(content)
                    }],
                    parent: pluginTips.Container
                }, this.style(), this.event(), id != null ? {
                    attributes: {
                        id: id
                    }
                } : {}))
            }
            event() {
                return {
                    onclick: (e: any) => {
                        switch (this.type) {
                            case TipsType.Info:
                            case TipsType.Success:
                            case TipsType.Warning:
                                e.currentTarget.remove()
                                break;
                            case TipsType.Dialog:
                            default:
                                break;
                        }
                    },
                    onanimationend: (e: any) => {
                        if (!this.wait) {
                            e.currentTarget.remove()
                        }
                    }
                }
            }
            style() {
                let style = {
                    className: ['tips']
                }
                style.className.push('tips' + TipsType[this.show])
                style.className.push(this.wait ? 'tipsWait' : 'tipsActive')
                return style
            }
        }
    
    
    
        
        let sttt = {
            nodeType: "div",
            attributes: {
                style: "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);",
            },
            className: "float-window",
            childs: {
                nodeType: "div",
                attributes: {
                    style: "background-color: #fff; padding: 10px;"
                },
                className: "float-content",
                childs: [
                    {
                        nodeType: "p",
                        childs: "This is a floating window!"
                    },
                    {
                        nodeType: "button",
                        events: {
                            click: () =>{}
                        },
                        childs: "Close"
                    }
                ]
            }
        }
    
        /*
        class Plugin {
            config: Config
            
            constructor(){
               
                this.config = new Config()
            }
        }
    
    
        let  test : RenderCode =  {
            nodeType: "input",
            attributes: {
                type: "checkbox"
            },
            className: 'selectButton',
            events: {
                click : (event: Event) => {
                    (event.target as HTMLElement).parentElement.querySelector('a.videoTeaser__title').getAttribute('href').trim().split('/')[2]
                }
            }
        }
    */
})();
//# sourceMappingURL=IwaraDownloadTool.user.js.map