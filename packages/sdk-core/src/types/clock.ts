/**
 * 时钟抽象接口
 * 用于解耦时间相关逻辑，便于测试时控制时间
 */

/**
 * 时钟接口
 */
export interface Clock {
  /**
   * 获取当前时间
   */
  now(): Date;

  /**
   * 延迟指定毫秒数
   * @param ms 延迟的毫秒数
   */
  sleep(ms: number): Promise<void>;

  /**
   * 设置定时器（可选，主要用于测试）
   * @param callback 回调函数
   * @param ms 延迟的毫秒数
   * @returns 定时器ID (Node.js 返回 Timeout 对象，浏览器返回 number)
   */
  setTimeout?(callback: () => void, ms: number): any;

  /**
   * 清除定时器（可选，主要用于测试）
   * @param id 定时器ID
   */
  clearTimeout?(id: any): void;
}

/**
 * 真实时钟实现
 * 生产环境使用，实际等待和获取当前时间
 */
export class RealClock implements Clock {
  /**
   * 获取当前时间
   */
  now(): Date {
    return new Date();
  }

  /**
   * 延迟指定毫秒数
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 设置定时器（使用真实的 setTimeout）
   * 兼容 Node.js (返回 Timeout) 和浏览器 (返回 number)
   */
  setTimeout(callback: () => void, ms: number): any {
    return setTimeout(callback, ms);
  }

  /**
   * 清除定时器（使用真实的 clearTimeout）
   * 兼容 Node.js (接受 Timeout) 和浏览器 (接受 number)
   */
  clearTimeout(id: any): void {
    clearTimeout(id);
  }
}

