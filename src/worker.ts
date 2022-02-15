
/**
 * evaluate script & rebuild solids, in seperate thread/webworker
 * @param {String} script the script
 * @param {String} fullurl full url of current script
 * @param {Object} parameters the parameters to use with the script
 * @param {Object} callback the callback to call once evaluation is done /failed
 * @param {Object} options the settings to use when rebuilding the solid
 */
module.exports = function rebuildGeometryWorker(self) {
    const rebuildGeometry = require('@jscad/core/src/code-evaluation/rebuildGeometry');
    self.onmessage = function (event) {
        if (event.data instanceof Object) {
            const { data } = event;
            if (data.cmd === 'generate') {
                rebuildGeometry(data, (err, message) => self.postMessage(message));
            }
        }
    };
};

