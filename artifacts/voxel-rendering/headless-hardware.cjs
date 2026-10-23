'use strict';
const {chromium}=require('playwright'),launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,channel:process.argv[1]?.endsWith('microvoxel-world-camera.cjs')?undefined:'chrome'});
