<strong>适用于强智教务系统，不保证各个大学通用。</strong>  

## 设计思路  

通过教务系统成绩查询网页或者 api，使用 javaScript 脚本定时（默认是  20 分钟）执行查询动作。  
得到成绩后将所有成绩保存到文件，之后每次检查时进行比对，如果有新增的成绩就进行推送。  
推送方案有多种选择，如方糖、Telegram Bot、邮件提醒、Bark 等。这里使用 [Bark](https://github.com/Finb/Bark) 进行推送。Bark 是一个十分简洁的 iOS 推送 App，利用 Apple 统一的推送通道，延迟很小，但不支持 Android 系统。Bark 也可以自已部署服务端，能保证隐私不被泄露。  
网页登录好像有定时强制注销用户的设定，即使一直访问也会出现需要登录的情况，出现 session 失效的情况可以在网页端重新登录一次，SessionId 不需要修改。

## 安装使用  

以 Linux 系统为例

### 安装 nodeJS 环境

``` sh
wget https://nodejs.org/dist/v12.18.2/node-v12.18.2-linux-x64.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v12.18.2-linux-x64.tar.xz -C /usr/local/lib/nodejs
```

执行 `vim /etc/profile` ，在文件最后加上以下内容：

``` sh
export PATH=/usr/local/lib/nodejs/node-v12.18.2-linux-x64/bin:$PATH
export NODE_PATH=/usr/local/lib/nodejs/node-v12.18.2-linux-x64/lib/node_modules
```

### 安装 nodeJS 模块

``` sh
npm install -g pm2 cheerio node-schedule iconv-lite axios socks-proxy-agent
```

### 下载脚本

``` sh
git clone https://github.com/Konata09/GradeCheck.git
cd GradeCheck
```

### 修改配置

打开 `config.json` 文件  
填写示例如下：

``` json
{
    "type": "api",
    "site": "jwgl.xxxx.edu.cn",
    "xh": "",
    "password": "",
    "JSESSIONID": "",
    "pushUrl": "https://xxx/xxx/",
    "proxy": "socks5://127.0.0.1:1080"
}
```

#### type

可选 `web` 或者 `api` 。  
代表成绩查询方法， `web` 代表从网页获取， `api` 代表从接口获取。  

从网页获取成绩不需要学号和密码，只需填写 `JSESSIONID` ，但可能会有 session 过期的问题。  
从接口获取成绩不需要 `JSESSIONID` ，需要填写学号和密码，相比从网页获取更加稳定。  

#### site

教务管理系统网址，不需要 http 前缀。

#### xh

学号，当 `type` 为 `web` 时，此项不必填写。

#### password

教务管理系统密码，当 `type` 为 `web` 时，此项不必填写。

#### JSESSIONID

用浏览器登录教务管理系统，将浏览器 Cookie 中的 `JSESSIONID=` 的后边内容填入。当 `type` 为 `api` 时，此项不必填写。

#### pushUrl

Bark 的推送地址。  
从 App Store 安装 Bark，即可得到推送地址，当然也可以是自己部署的服务端地址。

#### proxy

对教务系统进行代理访问的代理服务器地址，支持 Socks4 和 Socks5 代理。不使用留空即可。

### 运行脚本

``` sh
pm2 start gradeCheck.js
```

### 查看日志

``` sh
pm2 logs gradeCheck
```
