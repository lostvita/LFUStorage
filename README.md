# LFUStorage

基于[LFU](https://en.wikipedia.org/wiki/LFU)（最近最久未使用）策略和localStorage设计的web存储系统，改系统支持两种方式进行数据置换：
- 基于存储数量
- 基于内存大小

## Install
```shell
npm install lfustorage --save
```

## Usage
```javascript
import LFUStorage from 'lfustorage'
const storage = new LFUStorage(namespace)  // namespace 可选

storage.nameSpace(name).size(maxSize).expire(secs)
storage.set(key, val)
storage.get(key)
```

## Worker API
|Api|Params|Description|
| :-----| :---- | :---- |
|nameSpace|name|设置存储实例的命名空间。name: String/必须（对应localStorage的key值）|
|max|num|设置存储数量上限。max：Number/可选，默认值是50|
|size|val|设置存储空间上限|val: Number/非必须，默认值是4MB|
|expire|sec|设置过期时间|sec: Number/非必须。默认值7days|
|getMax|/|获取存储数量上限|
|getSize|/|获取存储空间上限|
|getRemainMax|/|获取剩余存储数量|
|getRemainSize|/|获取剩余存储空间|
|getExpire|/|获取过期时间|
|set|key,val|存储数据项。key: String/必须，val: 必须|
|get|key|获取数据项。key: String/必须|
|remove|key|删除数据项。key: String/必须|
|has|key|判断是否存在数据项。key: String/必须|
|keys|/|获取所有数据项的key值|
|values|/|获取所有数据项的值|
|entries|/|获取存储数据的键值对数组，结果基于LFU排序|
|clear|/|清除所有存储数据|
|on|evt,cb|订阅事件。evt: String，取值范围['expire', 'set', 'remove', 'clear', 'overflow']，cb: callback|
|off|evt|取消订阅事件。evt: String。取值范围['expire', 'set', 'remove', 'clear', 'overflow']|
## Example
```javascript
// 本地聊天缓存系统
import LFUStorage from 'lfu-storage'

const chatStorage = new LFUStorage('CHAT_MESSAGE')
chatStorage.max(10).expire(3 * 24 * 60 * 60) // 设置聊天信息缓存上限10条（个用户）3天后过期

// 订阅溢出事件
chatStorage.on('overflow', (res) => { console.log(`storage overflow,delete keys: ${res}`) })

// 订阅过期事件
chatStorage.on('expire',(namespace) => { console.log(`${namespace} is expired`) })

// 取消订阅
chatStorage.off('expire')

chatStorage.set(userId, messages)
```
