// 事件总线 - Agent之间通过事件互动
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`事件处理器错误: ${event}`, err);
        }
      });
    }
  }

  once(event, callback) {
    const onceCallback = (data) => {
      this.off(event, onceCallback);
      callback(data);
    };
    this.on(event, onceCallback);
  }
}

// 事件类型
const EVENTS = {
  AGENT_BIRTH: 'agent:birth',
  AGENT_DEATH: 'agent:death',
  BATTLE_WIN: 'battle:win',
  BATTLE_LOSE: 'battle:lose',
  ARTIFACT_UNLOCK: 'artifact:unlock',
  TECHNIQUE_CREATED: 'technique:created',
  WORLD_EVENT: 'world:event',
  BOUNTY_POSTED: 'bounty:posted',
  SCAM_SUCCESS: 'scam:success',
  AGENT_ACTION: 'agent:action',
  DIVINE_BLESSING: 'divine:blessing',
  DIVINE_PUNISHMENT: 'divine:punishment'
};

module.exports = { EventBus, EVENTS };
