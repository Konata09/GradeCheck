const http = require('http');
const https = require('https');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const fs = require('fs');
const schedule = require('node-schedule');

// 推送地址
const pushUrl = 'https://'
// 成绩查询地址
const url = 'http://教务系统域名/jsxsd/kscj/cjcx_list';
const options = {
    method: 'GET',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
        'Cookie': 'JSESSIONID=', // JSESSIONID 需要修改
    }
};

var subject = {
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

var chunks = [];
// 执行查询
async function checkGrade() {
    console.log('开始查询: ' + new Date());
    let res = await doHttpRequest(url, options);
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (chunk) => {
        chunks = chunks.concat(chunk);
    });
    res.on('end', async () => {
        let gbkhtml = iconv.decode(Buffer.concat(chunks), 'gbk');
        if (gbkhtml.includes('请先登录') || gbkhtml.includes('非法')) {
            console.log('session失效，请在网页端重新登录');
            return;
        }
        let html = iconv.decode(Buffer.concat(chunks), 'utf-8');
        var result = await readLocalFile();  // 从本地文件读取之前的记录
        $ = cheerio.load(html);
        let trs = $('#dataList').children().children()  // 表格全部行
        for (let i = 1; i < 12; i++) {  // 第0行是表头 不需要
            let tr = $(trs[i]);  // 每条记录
            if (tr.length === 0) {  // 已经到达最后一条记录
                break;
            } else {
                let subjectOnce = deepCopy(subject);
                let tds = tr.children();
                let j = 1;  // 第一个单元格是序号 不需要
                for (let i in subjectOnce) {    // 将一条记录中每个字段存入对象
                    subjectOnce[i] = $(tds[j]).text()
                    j++;
                }
                let sig = true;    // 标记是否为新记录
                for (const key in result) {    // 遍历从本地文件中读取的记录
                    if (JSON.stringify(result[key]) === JSON.stringify(subjectOnce)) {
                        sig = false;  // 有相同的记录 将标记设为 false
                        break;
                    }
                }
                if (sig) {
                    console.log('你有新的课程成绩' + JSON.stringify(subjectOnce));
                    await doHttpsRequest(`${pushUrl}/你有新的课程成绩/${subjectOnce.课程名称}   成绩:${subjectOnce.成绩}   学分:${subjectOnce.学分}`)   // Bark 推送
                    result.push(subjectOnce);   // 加入本条记录
                }
            }
        }
        fs.writeFileSync('gradestorage.json', JSON.stringify(result))  // 将记录写回 json 文件
    });
}

// 读取本地 json 文件
async function readLocalFile() {
    let data = await new Promise((resolve, reject) => {
        fs.readFile('gradestorage.json', 'utf8', (err, data) => {
            if (err) resolve(err);
            //console.log(rs)
            var obj = JSON.parse(data);
            resolve(obj);
        })
    })
    return data;
}

// 对象深拷贝
function deepCopy(obj) {
    var target = {};
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (typeof obj[key] === 'object') {
                target[key] = deepCopy(obj[key]);
            } else {
                target[key] = obj[key];
            }
        }
    }
    return target;
}

// 执行HTTP请求
function doHttpRequest(url, options) {
    return new Promise((resolve, reject) => {
        let req = http.request(url, options);
        req.on('response', res => {
            resolve(res);
        });
        req.on('error', err => {
            reject(err);
        });
        req.end();
    });
}

// 执行HTTPS请求
function doHttpsRequest(url, options) {
    return new Promise((resolve, reject) => {
        let req = https.request(url, options);
        req.on('response', res => {
            resolve(res);
        });
        req.on('error', err => {
            reject(err);
        });
        req.end();
    });
}

// 定时运行规则
let rule = new schedule.RecurrenceRule();
rule.minute = [0, 20, 40]; // 每隔 20 分钟执行一次

// 启动任务
schedule.scheduleJob(rule, () => {
    checkGrade()
});