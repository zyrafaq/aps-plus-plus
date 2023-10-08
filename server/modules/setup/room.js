let importedRoom = [];

for (let filename of c.ROOM_SETUP) {
    let currentRoom = require(`./rooms/${filename}.js`);
    for (let y = 0; y < currentRoom[0].length; y++) {
        for (let x = 0; x < currentRoom.length; x++) {
            if (currentRoom[y][x]) {
                if (importedRoom[y] == null) {
                    importedRoom[y] = currentRoom[y];
                }
                importedRoom[y][x] = currentRoom[y][x];
            }
        }
    }
}

global.room = {
    tileWidth: c.TILE_WIDTH,
    tileHeight: c.TILE_HEIGHT,
    lastCycle: undefined,
    cycleSpeed: 1000 / 30,
    setup: importedRoom,
    xgrid: importedRoom[0].length,
    ygrid: importedRoom.length,
    topPlayerID: -1,
    partyHash: Number(((Math.random() * 1000000 | 0) + 1000000).toString().replace("0.", "")),
    spawnableDefault: [],
    spawnable: {},
    blackHoles: []
};

room.width = room.xgrid * room.tileWidth;
room.height = room.ygrid * room.tileHeight;
room.center = { x: room.width / 2, y: room.height / 2 };

room.maxFood = room.width * room.height / 20000 * c.FOOD_AMOUNT;
room.scale = { square: room.width * room.height / 100_000_000 };
room.scale.linear = Math.sqrt(room.scale.square);


room.isInRoom = location => {
    if (c.ARENA_TYPE === "circle") {
        return (location.x - room.center.x) ** 2 + (location.y - room.center.y) ** 2 < room.center.x ** 2;
    }
    return location.x >= 0 && location.x <= room.width && location.y >= 0 && location.y <= room.height;
};
room.near = function(position, radius) {
    let point = ran.pointInUnitCircle();
    return {
        x: Math.round(position.x + radius * point.x),
        y: Math.round(position.y + radius * point.y)
    };
};
room.random = function() {
    if (c.ARENA_TYPE === "circle") {
        return room.near(room.center, room.center.x);
    }
    return {
        x: ran.irandom(room.width),
        y: ran.irandom(room.height)
    };
};
room.randomType = function(type) {
    if (!room[type]) return room.random();
    let selection = room[type][ran.irandom(room[type].length - 1)];
    if (c.ARENA_TYPE === "circle") {
        let loc = JSON.parse(JSON.stringify(selection));
        let i = 100;
        do {
            loc = {
                x: ran.irandom(0.5 * room.width / room.xgrid) * ran.choose([-1, 1]) + selection.x,
                y: ran.irandom(0.5 * room.height / room.ygrid) * ran.choose([-1, 1]) + selection.y
            };
            i--;
        } while (util.getDistance(loc, selection) > (room.width / room.xgrid) * 0.45 && i);
        return loc;
    }
    return {
        x: ran.irandom(0.5 * room.width / room.xgrid) * ran.choose([-1, 1]) + selection.x,
        y: ran.irandom(0.5 * room.height / room.ygrid) * ran.choose([-1, 1]) + selection.y,
    };
};
room.isIn = function(type, location, extendedWidth = false) {
    if (!room.isInRoom(location)) return false;
    let a = Math.floor(location.y * room.ygrid / room.height);
    let b = Math.floor(location.x * room.xgrid / room.width);
    if (!room.setup[a]) return false;
    if (!room.setup[a][b]) return false;
    if (c.ARENA_TYPE === "circle") {
        let cell = room[room.setup[a][b]].sort(function(a, b) {
            return util.getDistance(a, location) - util.getDistance(b, location);
        })[0];
        if (util.getDistance(cell, location) > (room.width / room.xgrid) * 0.5) return false;
    }
    if (extendedWidth) {
        let c = a - 1 > -1;
        let d = a + 1 < room.setup.length;
        let e = b - 1 > -1;
        let f = b + 1 < room.setup[a].length;
        let left = (c ? type === room.setup[a - 1][b] : false);
        let right = (d ? type === room.setup[a + 1][b] : false);
        let up = (e ? type === room.setup[a][b - 1] : false);
        let down = (f ? type === room.setup[a][b + 1] : false);
        let northWest = (c && e ? type === room.setup[a - 1][b - 1] : false);
        let northEast = (d && e ? type === room.setup[a + 1][b - 1] : false);
        let southWest = (c && f ? type === room.setup[a - 1][b + 1] : false);
        let southEast = (d && f ? type === room.setup[a + 1][b + 1] : false);
        let center = type === room.setup[a][b];
        return left || right || up || down || northWest || northEast || southWest || southEast || center;
    }
    return type === room.setup[a][b];
};
room.isAt = function(location) {
    if (!room.isInRoom(location)) return false;
    let x = Math.floor(location.x * room.xgrid / room.width);
    let y = Math.floor(location.y * room.ygrid / room.height);
    return {
        x: (x + .5) / room.xgrid * room.width,
        y: (y + .5) / room.ygrid * room.height,
        id: x * room.xgrid + y
    };
};
room.isInNorm = function(location) {
    if (!room.isInRoom(location)) return false;
    let a = Math.floor(location.y * room.ygrid / room.height);
    let b = Math.floor(location.x * room.xgrid / room.width);
    if (!room.setup[a]) return false;
    if (!room.setup[a][b]) return false;
    return room.setup[a][b] !== 'nest';
};
room.gauss = function(clustering) {
    let output;
    do {
        output = {
            x: ran.gauss(room.width / 2, room.height / clustering),
            y: ran.gauss(room.width / 2, room.height / clustering),
        };
    } while (!room.isInRoom(output));
    return output;
};
room.gaussInverse = function(clustering) {
    let output;
    do {
        output = {
            x: ran.gaussInverse(0, room.width, clustering),
            y: ran.gaussInverse(0, room.height, clustering),
        };
    } while (!room.isInRoom(output));
    return output;
};
room.gaussRing = function(radius, clustering) {
    let output;
    do {
        output = ran.gaussRing(room.width * radius, clustering);
        output = {
            x: output.x + room.width / 2,
            y: output.y + room.height / 2,
        };
    } while (!room.isInRoom(output));
    return output;
};
room.gaussType = function(type, clustering) {
    if (!room[type]) return room.random();
    let selection = room[type][ran.irandom(room[type].length - 1)];
    let location = {};
    do {
        location = {
            x: ran.gauss(selection.x, room.width / room.xgrid / clustering),
            y: ran.gauss(selection.y, room.height / room.ygrid / clustering),
        };
    } while (!room.isIn(type, location));
    return location;
};
room.getAt = location => {
    if (!room.isInRoom(location)) return undefined;
    let a = Math.floor(location.y  / room.tileWidth);
    let b = Math.floor(location.x  / room.tileHeight);
    return room.setup[a][b];
};

class TileEntity {
    constructor (tile, loc) {
        if (!(tile instanceof Tile)) {
            throw new Error('A cell in the room setup is not a Tile object!' +
                ('string' == typeof tile ? ' But it is a string, which means you probably need to update your room setup!' : '')
            );
        }
        // this.blueprint = tile.args;
        this.loc = {
            x: room.tileWidth * loc.x + room.tileWidth / 2,
            y: room.tileHeight * loc.y + room.tileHeight / 2
        };
        this.color = tile.color;
        this.init = tile.init;
        this.tick = tile.tick;
        this.entities = [];
        this.data = JSON.parse(JSON.stringify(tile.data));
    }

    //Dummy
    init () {}
    tick () {}

    randomInside() {
        return {
            x: this.loc.x + (room.tileWidth * (Math.random() - 0.5)),
            y: this.loc.y + (room.tileHeight * (Math.random() - 0.5))
        }
    }
}

for (let y in room.setup) {
    for (let x in room.setup[y]) {
        let tile = room.setup[y][x] = new TileEntity(room.setup[y][x], { x, y });
        tile.init(tile);
    }
}

function roomLoop() {
    for (let i = 0; i < entities.length; i++) {
        let tile = room.getAt(entities[i])
        if (tile) tile.entities.push(entities[i]);
    }

    for (let y = 0; y < room.setup; y++) {
        for (let x = 0; x < room.setup[y]; x++) {
            tile.tick(tile);
            tile.entities = [];
        }
    }
}

module.exports = { roomLoop };