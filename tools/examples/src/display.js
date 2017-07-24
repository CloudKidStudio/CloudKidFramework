// Import modules
import {Graphics} from 'pixi.js';
import {Application} from '@springroll/core';
import '@springroll/display';

// Create the new springroll application
const app = new Application({
    display: { backgroundColor: 0x1e528c }
});

app.on('ready', function() {
    // Add a circle to the stage
    app.display.stage.addChild(new Graphics()
        .beginFill(0x69a1df)
        .drawCircle(400, 300, 100)
    );
});