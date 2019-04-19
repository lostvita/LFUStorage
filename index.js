/**
 * LFU(最近最久未使用)本地存储系统
 */

import { sizeof, clone, arr2Obj, warn } from './lib/utils'
import Pubsub from './lib/pubsub'

class LFUStorage {
    constructor (nameSpace) {
        this.$nameSpace = nameSpace
        this._pubsub = new Pubsub()
        this._evtToken = new Map
        this._initStorage()
        this._calculateRemainSize()
    }

    get SIZE () {
        return 4 * 1024 *1024 // 4MB
    }

    get MAX () {
        return 50
    }

    get _EVENT () {
        return new Set(['expire', 'set', 'remove', 'clear', 'overflow'])
    }

    nameSpace (nameSpace) {
        if(!nameSpace) {
            warn('LFUStorage: namespace should not empty.')
            return
        }
        this.$nameSpace = nameSpace
        this._initStorage()
        return this
    }

    max (num) {
        this.$max = num || this.MAX
        return this
    }

    size (size) {
        this.$size = size || this.SIZE
        return this
    }

    expire (secs) {
        if(!this.$nameSpace){
            warn('LFUStorage: Please set namespace first.')
            return
        }
        this.$expire = secs || 7 * 24 * 60 * 60
        const lfuExpire = JSON.parse(window.localStorage.getItem('LFU_STORAGE_EXPIRE') || '{}')
        if(!lfuExpire[this.$nameSpace]) {
            lfuExpire[this.$nameSpace] = Date.now()
            window.localStorage.setItem('LFU_STORAGE_EXPIRE', JSON.stringify(lfuExpire))
        }
        return this
    }

    getSize () {
        return this.$size
    }

    getMax () {
        return this.$max
    }

    getNameSpace () {
        return this.$nameSpace
    }

    getRemainSize () {
        return this.$remainSize
    }

    getExpire () {
        return this.$expire
    }

    set (key, data) {
        data = clone(data)
        let weight = 1
        if(this.has(key)) { // 先更新
            weight = this._find(key)._weight + 1
        }
        const { max, size } = this._isOverflow(key, data)
        if(size === -1) {
            warn(`LFUStorage: exceed maxsize, store ${key} failed.`)
            return this
        } else if(!max || size) {
            const del = this._delete(size, key)
            this._pubsub.publish('overflow', del)
            if(!del) {
                warn(`LFUStorage: exceed maxsize, store ${key} failed.`)
                return this
            }
        }
        const val = Object.assign({
            _id: key,
            _weight: weight,
            _lastmodify: new Date().getTime()
        }, data)
        this.$storage[key] = val
        this._update()
        this._pubsub.publish('set', key)
        return this
    }

    get (key) {
        this._delExpire()
        const exclude = new Set(['_id', '_weight', '_lastmodify'])
        const val = Reflect.get(this.$storage, key)
        return val ? Object.keys(val)
              .filter(each => !exclude.has(each))
              .reduce((acc, curr) => {
                  acc[curr] = val[curr]
                  return acc
              }, {})
            : null
    }

    remove (key) {
        const ret = Reflect.deleteProperty(this.$storage, key)
        if(ret) {
            this._update()
            this._pubsub.publish('remove', key)
        }
        return ret
    }

    keys () {
        this._delExpire()
        return Object.keys(this.$storage)
    }

    values () {
        this._delExpire()
        const exclude = new Set(['_id', '_weight', '_lastmodify'])
        return Object.values(this.$storage)
                     .sort((a, b) => b._weight - a._weight)
                     .map(each => Object.keys(each)
                        .filter(key => !exclude.has(key))
                        .reduce((acc, curr) => {
                            acc[curr] = each[curr]
                            return acc
                        }, {})
                     )
    }

    entries () {
        this._delExpire()
        const exclude = new Set(['_id', '_weight', '_lastmodify'])
        return Object.entries(
                    Object.values(this.$storage)
                    .sort((a, b) => b._weight - a._weight)
                    .reduce((acc, curr) => {
                        acc[curr._id] = Object.keys(curr)
                            .filter(key => !exclude.has(key))
                            .reduce((accer, key) => {
                                accer[key] = curr[key]
                                return accer
                            }, {})
                        return acc
                    }, {})
                )
    }

    on (evt, cb) {
        if(!this._EVENT.has(evt) || typeof cb !== 'function') return this
        const token = this._pubsub.subscribe(evt, cb)
        this._evtToken.set(evt, token)
        return this
    }

    off (evt) {
        if(!this._EVENT.has(evt) || !this._evtToken.has(evt)) return this
        const token = this._evtToken.get(evt)
        this._pubsub.unsubscribe(token)
        return this
    }

    has (key) {
        return Reflect.has(this.$storage, key)
    }

    clear () {
        this.$storage = Object.create(null)
        window.localStorage.removeItem(this.$nameSpace)
        if(!this._isExpire()) {
            this._pubsub.publish('clear', this.$nameSpace)
        }
        return this
    }

    _initStorage () {
        this.$max = this.MAX
        this.$size = this.SIZE
        this._delExpire()
        this.$storage = JSON.parse(window.localStorage.getItem(this.$nameSpace)) || Object.create(null)
        this._amount = this.keys().length
    }

    _find (key) {
        return Reflect.get(this.$storage, key)
    }

    _delete(size, id) {
        let delArr = null
        let delSize = 0
        const delKeys = []
        const emptyObjSize = sizeof(JSON.stringify({}))
        const storageArr = Object.values(this.$storage)
                               .sort((a, b) => a._weight - b._weight)
                               .filter(each => each._id !== id)
        const len = storageArr.length
        let position = 0
        for(let i = 0; i < len; i++) {
            delKeys.push(storageArr[i]._id)
            delArr = storageArr.slice(0, i + 1)
            delSize = sizeof(JSON.stringify(arr2Obj(delArr))) - emptyObjSize
            position = i
            if(delSize >= size) {
                size = 0
                break
            }
        }
        if(size) return false
        const remainArr = storageArr.slice(position + 1, len)
        const storage = remainArr.reduce((acc, curr) => {
            acc[curr._id] = curr
            return acc
        }, {})
        this.$storage = storage
        return delKeys
    }

    _delExpire () {
        if(this._isExpire()) {
            this._pubsub.publish('expire', this.$nameSpace)
            this._pubsub.unsubscribe('expire')
            this.clear()
            this._updateLfuExpire()
        }
    }

    _update () {
        window.localStorage.setItem(this.$nameSpace, JSON.stringify(this.$storage))
        this._amount = this.keys().length
        this._calculateRemainSize()
    }

    _updateLfuExpire () {
        const _expire = JSON.parse(window.localStorage.getItem('LFU_STORAGE_EXPIRE'))
        Reflect.deleteProperty(_expire, this.$nameSpace)
        window.localStorage.setItem('LFU_STORAGE_EXPIRE', JSON.stringify(_expire))
    }

    _isOverflow (key, data) {
        let valSize = 0
        let max = this._amount - (this.$max || -1)
        let size = 0
        
        const val = this._find(key)
        const lfuData = Object.assign({
            _id: key,
            _weight: val ? val._weight + 1 : 1,
            _lastmodify: new Date().getTime()
        }, data)
        if(!val) { // 新数据
            const temp = {}
            temp[key] = lfuData
            valSize = sizeof(JSON.stringify(temp))
        } else {
            const diff = sizeof(JSON.stringify(val)) - sizeof(JSON.stringify(lfuData))
            valSize = diff > 0 ? 0 : Math.abs(diff)
        }
        if(valSize > this.$size) {
            size = -1
        } else if(valSize > this.$remainSize) {
            size = valSize - this.$remainSize
        }
        return { max, size }
    }

    _isExpire () {
        let _expire = JSON.parse(window.localStorage.getItem('LFU_STORAGE_EXPIRE'))
        _expire = _expire ? _expire[this.$nameSpace] : null
        if(!_expire) return false
        const now = Date.now()
        return  now > (_expire + this.$expire * 1000)
    }

    _calculateRemainSize () {
        this.$remainSize = this.$size - sizeof(window.localStorage.getItem(this.$nameSpace || ''))
    }
}

export default LFUStorage