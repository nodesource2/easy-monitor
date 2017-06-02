'use strict';
const co = require('co');

module.exports = function (app) {
    //取出公共对象
    const common = this.common;
    const config = this.config;
    const dbl = this.dbl;
    const cacheUtils = common.cache;
    const httpUtils = common.http;

    /**
     * @param {object} params
     * @description 获取缓存信息
     */
    function* getNowStat(params) {
        //组装缓存 key
        const key = common.profiler.composeKey(params);
        //从缓存中获取信息
        let cacheData = yield cacheUtils.storage.getP(config.cache.opt_list);
        cacheData = typeof cacheData === 'object' && cacheData || common.utils.jsonParse(cacheData);
        const result = Object.keys(cacheData).reduce((pre, next) => {
            if (~next.indexOf(key)) {
                const id = Number(next.replace(key, ''));
                if (id > pre.id) {
                    pre.id = id;
                    pre.res = cacheData[next];
                }
            }
            return pre;
        }, { id: 0, res: '{}' }).res;

        return result;
    }

    /**
     * @param {string} data 
     * @description 根据传入的 data 结构内容，判断是否需要清除掉缓存
     */
    function* clearCache(params, data) {
        data = common.utils.jsonParse(data);
        if (data.done) {
            //组装缓存 key
            const key = common.profiler.composeKey(params);
            //清除缓存
            let cacheData = yield cacheUtils.storage.getP(config.cache.opt_list);
            cacheData = typeof cacheData === 'object' && cacheData || common.utils.jsonParse(cacheData);
            const cacheList = Object.keys(cacheData);
            for (let i = 0, l = cacheList.length; i < l; i++) {
                if (~cacheList[i].indexOf(key)) {
                    yield cacheUtils.storage.delP(cacheList[i], config.cache.opt_list);
                }
            }
        }
    }

    /**
     * @description 获取 cpu / memory profiler 详细信息
     */
    function* axiosProfilerDetail(req, res, next) {
        try {
            const body = req.body;
            const data = body && body.data;
            dbl.debug(`http.axios.detail receive data: ${JSON.stringify(data)}`);

            //body 为空返回错误
            if (!data) res.send(httpUtils.composeMessage(1));

            //根据组装 key 方式获取缓存数据
            const params = { pid: data.pid, opt: data.opt, name: data.processName, server: data.serverName };
            const result = yield getNowStat(params);

            res.send(httpUtils.composeMessage(0, result));

            //判断是否需要清除掉缓存
            yield clearCache(params, result);
        } catch (e) {
            dbl.error(`http.axios.detail error: ${e}`);
            res.send(httpUtils.composeMessage(3));
        }
    }

    //以下是此 controller 文件注册的路由
    app.post('/axiosProfilerDetail', co.wrap(axiosProfilerDetail));
}