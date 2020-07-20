<strong>适用于强智教务系统，不保证各个大学通用。</strong>  

### 设计思路  

得到成绩查询页面的地址，使用 javaScript 脚本定时（默认定是 20 分钟）执行查询动作。  
得到成绩后将所有成绩保存到文件，之后每次检查时进行比对，如果有新增的成绩就进行推送。  
推送方案有多种选择，如方糖、Telegram Bot、邮件提醒、Bark 等。这里使用 [Bark](https://github.com/Finb/Bark) 进行推送。Bark 是一个十分简洁的 iOS 推送 App，利用 Apple 统一的推送通道，延迟很小，但不支持 Android 系统。Bark 也可以自已部署服务端，能保证隐私不被泄露。  
服务端好像有定时强制注销用户的设定，即使一直访问也会出现需要登录的情况，可以先在网页端重新登录一次，SessionId 不需要修改。

### 安装使用  

以 Linux 系统为例

#### 安装 nodeJS 环境

``` sh
wget https://nodejs.org/dist/v12.18.2/node-v12.18.2-linux-x64.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v12.18.2-linux-x64.tar.xz -C /usr/local/lib/nodejs
vim /etc/profile
//在最后一行加上如下内容
export PATH=/usr/local/lib/nodejs/node-v12.18.2-linux-x64/bin:$PATH
export NODE_PATH=/usr/local/lib/nodejs/node-v12.18.2-linux-x64/lib/node_modules
```

#### 安装 nodeJS 模块

``` sh
npm install -g pm2 cheerio node-schedule iconv-lite
```

#### 修改脚本

首先下载脚本  

``` sh
git clone https://github.com/Konata09/GradeCheck.git
cd GradeCheck
```

修改 `gradeCheck.js` 文件  

1. 安装 Bark App 得到推送地址，填入 pushUrl 中；

2. 得到成绩查询结果页面的地址，应该是在 iframe 内，可能以 `/jsxsd/kscj/cjcx_lis` 结尾。将地址填入 url 中；

3. 获取浏览器 Cookie 中的 JSESSIONID，填入 headers 的 Cookie 键值中。

#### 运行脚本

``` sh
pm2 start gradeCheck.js
```

查看日志

``` sh
pm2 logs gradeCheck
```
