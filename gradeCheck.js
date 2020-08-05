const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const fs = require('fs');
const schedule = require('node-schedule');
const SocksProxyAgent = require('socks-proxy-agent');

let conf = {
    "site": "",
    "type": "",
    "xh": "",
    "password": "",
    "JSESSIONID": "",
    "pushUrl": "",
    "proxy": ""
}

const subject_web_sample = {
    开课学期: '',
    课程编号: '',
    课程名称: '',
    成绩: '',
    成绩标志: '',
    课程属性: '',
    学分: '',
    绩点: '',
    考核方式: '',
    辅修课程: '',
    备注: '',
};

const subject_api_sample = {
    xqmc: '',   // 学期名称
    kcmc: '', // 课程名称
    kcywmc: '', // 课程英文名称
    zcj: '', // 成绩
    kclbmc: '', // 课程属性
    xf: 0,  // 学分
    kcxzmc: '', // 课程性质
    ksxzmc: '', // 考核方式
};

let agent = undefined;

// 初始化 读取配置 设置定时任务
async function init() {
    await readLocalFile('config.json')
        .then((data) => {
            conf = data;
            if (conf.proxy !== '') {
                agent = new SocksProxyAgent(conf.proxy);
            }
            let rule = new schedule.RecurrenceRule(); // 定时运行规则
            rule.minute = [0, 20, 40]; // 每隔 20 分钟执行一次
            schedule.scheduleJob(rule, () => {
                conf.type === 'web' ? checkFromWeb() : checkFromApi();
            });
        })
        .catch((e) => {
            console.log('conf.json 文件不存在或格式不正确');
            console.log(e);
        })
}

// 从 api 查询成绩
async function checkFromApi() {
    console.log('开始查询: ' + new Date());
    await apiLogin().then((token) => {
        axios({
            url: `http://${conf.site}//app.do?xh=${conf.xh}&xnxqid=&method=getCjcx`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
                'token': token
            },
            timeout: 1000,
            httpAgent: agent
        })
            .then(async (res) => {
                let localfile = await readLocalFile('gradestorage.json');  // 从本地文件读取之前的记录
                let subjects = localfile.api;  // 从本地文件读取之前的记录
                for (const j in res.data) {
                    let subject = deepCopy(subject_api_sample);
                    for (const i in subject) {    // 将一条记录中每个字段存入对象
                        subject[i] = res.data[j][i];
                    }
                    let sig = true;    // 标记是否为新记录
                    for (const key in subjects)     // 遍历从本地文件中读取的课程
                        if (JSON.stringify(subjects[key]) === JSON.stringify(subject)) {
                            sig = false;  // 有相同的记录 将标记设为 false
                            break;
                        }
                    if (sig) {
                        console.log('你有新的课程成绩' + JSON.stringify(subject));
                        await doPush(subject.kcmc, subject.zcj, subject.xf).catch((err) => (console.log('推送失败\n' + err)))
                        subjects.push(subject);   // 加入本条记录
                    }
                }
                localfile.api = subjects
                fs.writeFileSync('gradestorage.json', JSON.stringify(localfile));  // 将记录写回 json 文件
            })
            .catch((err) => (console.log('查询失败\n' + err)))
    })
        .catch((err) => (console.log('账号登录失败\n' + err)))
}

// 从网页查询成绩
async function checkFromWeb() {
    console.log('开始查询: ' + new Date());
    axios({
        url: `http://${conf.site}/jsxsd/kscj/cjcx_list`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
            'Cookie': `JSESSIONID=${conf.JSESSIONID}`
        },
        timeout: 1000,
        responseType: 'arraybuffer',
        httpAgent: agent
    })
        .then(async (buffer) => {
            let gbkhtml = iconv.decode(buffer.data, 'gbk');
            if (gbkhtml.includes('请先登录') || gbkhtml.includes('非法')) {
                console.log('session失效，请在网页端重新登录');
                return;
            }
            let html = iconv.decode(buffer.data, 'utf-8');
            let localfile = await readLocalFile('gradestorage.json');  // 从本地文件读取之前的记录
            let subjects = localfile.web;  // 从本地文件读取之前的记录
            $ = cheerio.load(html);
            let trs = $('#dataList').children().children()  // 表格全部行
            for (let i = 1; ; i++) {  // 第0行是表头 不需要
                let tr = $(trs[i]);  // 每条记录
                if (tr.length === 0) {  // 已经到达最后一条记录
                    break;
                } else {
                    let subject = deepCopy(subject_web_sample);
                    let tds = tr.children();
                    let j = 1;  // 第一个单元格是序号 不需要
                    for (let i in subject) {    // 将一条记录中每个字段存入对象
                        subject[i] = $(tds[j]).text();
                        j++;
                    }
                    let sig = true;    // 标记是否为新记录
                    for (const key in subjects)     // 遍历从本地文件中读取的课程
                        if (JSON.stringify(subjects[key]) === JSON.stringify(subject)) {
                            sig = false;  // 有相同的记录 将标记设为 false
                            break;
                        }
                    if (sig) {
                        console.log('你有新的课程成绩' + JSON.stringify(subject));
                        await doPush(subject.课程名称, subject.成绩, subject.学分).catch((err) => (console.log('推送失败\n' + err)))
                        subjects.push(subject);   // 加入本条记录
                    }
                }
            }
            localfile.web = subjects
            fs.writeFileSync('gradestorage.json', JSON.stringify(localfile));  // 将记录写回 json 文件
        })
        .catch((err) => (console.log('查询失败\n' + err)));
}

// api 登录
function apiLogin() {
    return new Promise((resolve, reject) => {
        axios({
            url: `http://${conf.site}/app.do?method=authUser&xh=${conf.xh}&pwd=${conf.password}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
            },
            timeout: 1000,
            httpAgent: agent
        }).then((res) => {
            token = res.data.token;
            if (token === '-1')
                reject(res.data.msg);
            else
                resolve(token);
        }).catch((err) => (reject(err)));
    });
}

// Bark 推送
function doPush(courseName, grade, credit) {
    return axios({
        url: encodeURI(`${conf.pushUrl}/你有新的课程成绩/${courseName}   成绩:${grade}   学分:${credit}`),
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
        },
        timeout: 1000,
    });
}

// 读取 json 文件
function readLocalFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) reject(err);
            try {
                let obj = JSON.parse(data);
                resolve(obj);
            } catch (e) {
                reject(e);
            }
        });
    });
}

// 对象深拷贝
function deepCopy(obj) {
    let target = {};
    for (let key in obj)
        if (Object.prototype.hasOwnProperty.call(obj, key))
            if (typeof obj[key] === 'object')
                target[key] = deepCopy(obj[key]);
            else
                target[key] = obj[key];
    return target;
}

init();