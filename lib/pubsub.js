/**
 * 发布/订阅模式组件
 * @author  wilton
 */

class Pubsub {
	constructor () {
		this.topics = {}
		this.subUid = -1
	}

	// 发布事件
	publish (topic, args) {
		if(!this.topics[topic]) return false

		const subscribers = this.topics[topic]
		let len = subscribers ? subscribers.length : 0

		while(len--) {
			subscribers[len].func(args)
		}

		return this
	}

	// 订阅事件
	subscribe (topic,func) {
		if (!this.topics[topic]) this.topics[topic] = []

		const token = (++this.subUid).toString()
		this.topics[topic].push({
			token: token,
			func: func
		})

		return token
	}

	// 取消订阅
	unsubscribe (token) {
		const topics = this.topics
		for (let key in topics) {
            if(topics[key].some(each => each.token != token)) continue
            topics[key] = topics[key].filter(each => each.token !== token)
            break
		}
		return this
	}
}

export default Pubsub