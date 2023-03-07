"use strict";

const xmlToJson = require("./xml-to-json.service");
const {
    includes,
    compact,
    isArray,
    each,
    map,
    flattenDeep,
    groupBy,
    sortBy,
    orderBy,
    uniqBy
} = require("lodash");
const lodash = require("lodash");

module.exports = {
    parseOAI,
    parseXML,
    createItemDataStructure,
    createItemDataStructureFromGraphQL,
    groupByIdentifier,
    groupByGenre,
    groupBySpeaker
};

const types = {
    imageTypes: ["jpg", "jpeg", "png"],
    videoTypes: ["mp4", "ogg", "ogv", "mov", "webm"],
    audioTypes: ["mp3", "ogg", "oga"],
    transcriptionTypes: ["eaf", "trs", "ixt"],
    documentTypes: ["pdf"]
};

function parseOAI(d) {
    var tree = parseXML(d);

    try {
        tree = tree["OAI-PMH"].GetRecord.record.metadata["olac:olac"];
        return { data: createItemDataStructure(tree) };
    } catch (e) {
        return { data: "" };
    }
}

function parseXML(doc, as) {
    var parser = new DOMParser();
    var xmldoc = parser.parseFromString(doc, "text/xml");
    if (as === "xml") {
        return doc;
    }
    return xmlToJson.convert(xmldoc);
}

function createItemDataStructureFromGraphQL(data) {
    const collectionId = data.identifier.split("-")[0];
    const itemId = data.identifier.split("-")[1];

    const files = getFiles({ data, collectionId, itemId });
    const mediaFiles = compact(
        filterFiles([...types.videoTypes, ...types.audioTypes], files)
    );
    let imageFiles = compact(filterFiles(types.imageTypes, files));
    imageFiles = compact(
        imageFiles.filter(image => !image.name.match("thumb"))
    );
    const imageThumbnails = imageFiles.map(image => {
        let extension, basename, components, name, path;
        components = image.name.split(".");
        extension = components.pop();
        basename = components.join(".");
        name = `${basename}-thumb-PDSC_ADMIN.${extension}`;
        path = image.path.split("/");
        path.pop();
        path = path.join("/");
        return {
            name,
            type: image.type,
            path: `${path}/${name}`
        };
    });
    const documentFiles = compact(filterFiles(types.documentTypes, files));
    const transcriptionFiles = compact(
        filterFiles(types.transcriptionTypes, files)
    );
    const media = getMediaData([...mediaFiles, ...transcriptionFiles]);

    let struct = {
        audioVisualisations: {},
        citation: data.citation,
        collectionId: collectionId,
        collectionLink: data.permalink,
        contributor: constructContributorList({ data }),
        date: data.date,
        description: data.description,
        documents: documentFiles.map(document => document.path).sort(),
        identifier: [data.identifier, data.permalink],
        images: imageFiles.map(image => image.path).sort(),
        itemId: itemId,
        media: orderBy(media.media, "name"),
        audio: orderBy(media.audio, "name"),
        video: orderBy(media.video, "name"),
        openAccess: data.access_class === "open" ? true : false,
        rights: data.rights,
        thumbnails: sortBy(
            imageThumbnails.map(image => image.path),
            i => i.split(".")[0].split("-")[2]
        ),
        title: data.title,
        transcriptions: orderBy(
            transcriptionFiles.map(t => {
                return { name: t.name, url: t.path };
            }),
            "name"
        )
    };
    return struct;

    function constructContributorList({ data }) {
        return [
            { name: data.collector.name, role: "compiler" },
            ...data.roles.map(r => {
                return { name: r.user_name, role: r.role_name };
            })
        ];
    }

    function getMediaData(files) {
        let otherFiles = files.filter(f => {
            return ![...types.videoTypes, ...types.audioTypes].includes(
                f.name.split(".").pop()
            );
        });
        otherFiles = groupBy(otherFiles, f => f.name.split(".")[0]);

        let audioFiles = files.filter(f => {
            return types.audioTypes.includes(f.name.split(".").pop());
        });
        audioFiles = audioFiles.map(file => {
            if (otherFiles[file.name.split(".")[0]]) {
                return [file, otherFiles[file.name.split(".")[0]]];
            } else {
                return file;
            }
        });
        audioFiles = flattenDeep(audioFiles);
        audioFiles = groupBy(audioFiles, file => file.name.split(".")[0]);
        audioFiles = map(audioFiles, (v, k) => {
            return {
                name: k,
                files: filter([...v], "audio"),
                eaf: filter([...v], "eaf"),
                // flextext: filter([...v], 'flextext'),
                ixt: filter([...v], "ixt"),
                trs: filter([...v], "trs"),
                type: v[0].type.split("/")[0]
            };
        });

        let videoFiles = files.filter(f => {
            return types.videoTypes.includes(f.name.split(".").pop());
        });
        videoFiles = videoFiles.map(file => {
            if (otherFiles[file.name.split(".")[0]]) {
                return [file, otherFiles[file.name.split(".")[0]]];
            } else {
                return file;
            }
        });
        videoFiles = flattenDeep(videoFiles);
        videoFiles = groupBy(videoFiles, file => file.name.split(".")[0]);
        videoFiles = map(videoFiles, (v, k) => {
            return {
                name: k,
                files: filter([...v], "video"),
                eaf: filter([...v], "eaf"),
                // flextext: filter([...v], 'flextext'),
                ixt: filter([...v], "ixt"),
                trs: filter([...v], "trs"),
                type: v[0].type.split("/")[0]
            };
        });
        return {
            media: [...audioFiles, ...videoFiles],
            audio: audioFiles,
            video: videoFiles
        };
        return [...audioFiles, ...videoFiles];
        // files = groupBy(files, file => {
        //     return file.name.split(".")[0];
        // });
        // return map(files, (v, k) => {
        //     return {
        //         name: k,
        //         files: filter([...v], "media"),
        //         eaf: filter([...v], "eaf"),
        //         // flextext: filter([...v], 'flextext'),
        //         ixt: filter([...v], "ixt"),
        //         trs: filter([...v], "trs"),
        //         type: v[0].type.split("/")[0]
        //     };
        // });

        function filter(files, what) {
            if (what === "audio" || what === "video") {
                const set =
                    what === "audio" ? types.audioTypes : types.videoTypes;
                files = files.filter(file => {
                    return set.includes(file.name.split(".").pop());
                });
                return uniqBy(files.map(file => file.path), "name");
            } else {
                files = files.filter(file => {
                    return file.name.split(".").pop() === what;
                });
                return uniqBy(
                    files.map(file => {
                        return {
                            name: file.name,
                            url: file.path
                        };
                    }),
                    "name"
                );
            }
        }
    }

    function getFiles({ data, collectionId, itemId }) {
        let path = window.location.origin + `/repository/${collectionId}/${itemId}`;
        if (!isArray(data.files)) {
            data.files = [data.files];
        }
        return data.files.map(file => {
            return {
                name: file.filename,
                path: `${path}/${file.filename}`,
                type: file.mimetype
            };
        });
    }

    function filterFiles(types, files) {
        let extension;
        return files.filter(file => {
            extension = file.name.split(".").pop();
            return includes(types, extension);
        });
    }
}

function createItemDataStructure(tree) {
    if (!isArray(tree["dc:identifier"])) {
        tree["dc:identifier"] = [tree["dc:identifier"]];
    }
    if (!isArray(tree["dc:contributor"])) {
        tree["dc:contributor"] = [tree["dc:contributor"]];
    }
    var data = {
        openAccess: true,
        identifier: tree["dc:identifier"].map(d => {
            return d["#text"];
        }),
        title: get(tree, "dc:title"),
        date: get(tree, "dcterms:created"),
        description: get(tree, "dc:description"),
        citation: get(tree, "dcterms:bibliographicCitation"),
        contributor: tree["dc:contributor"].map(d => {
            return {
                name: d["#text"],
                role: d["@attributes"]["olac:code"]
            };
        }),
        images: constructItemList("images", tree),
        documents: constructItemList("documents", tree),
        media: processMedia(tree),
        rights: get(tree, "dcterms:accessRights")
    };

    data.transcriptions = flattenDeep(
        data.media.map(m => {
            return compact([m.eaf, m.trs, m.ixt, m.flextext]);
        })
    ).sort();

    // if the item is closed - set a flag to make it easier to work with in the view
    if (data.rights.match("Closed.*")) {
        data.openAccess = false;
    }

    data.thumbnails = generateThumbnails(data.images);
    data.audioVisualisations = generateAudioVisualisations(data.audio);
    return data;

    function processMedia(tree) {
        const audio = constructItemList("audio", tree);
        const video = constructItemList("video", tree);
        const eaf = processMediaItem("eaf", tree);
        const trs = processMediaItem("trs", tree);
        const ixt = processMediaItem("ixt", tree);
        const flextext = processMediaItem("flextext", tree);

        let media = [];
        each(audio, (files, key) => {
            media.push(createMediaItemDataStructure(key, files, "audio"));
        });
        each(video, (files, key) => {
            media.push(createMediaItemDataStructure(key, files, "video"));
        });
        return media;

        function processMediaItem(key, tree) {
            let item = constructItemList(key, tree);
            each(item, (v, k) => {
                item[k] = map(v, url => {
                    return {
                        name: url.split("/").pop(),
                        url: url
                    };
                });
            });
            return item;
        }

        function createMediaItemDataStructure(key, files, type) {
            return {
                name: key,
                type: type,
                files: files,
                eaf: eaf[key] ? eaf[key] : [],
                trs: trs[key] ? trs[key] : [],
                ixt: ixt[key] ? ixt[key] : [],
                flextext: flextext[key] ? flextext[key] : []
            };
        }
    }

    // helper to extract a value for 'thing'
    //  not every item has every datapoint
    function get(tree, thing) {
        try {
            return tree[thing]["#text"];
        } catch (e) {
            return "";
        }
    }
}

function constructItemList(type, tree) {
    var selector;
    if (type === "images") {
        selector = types.imageTypes;
    } else if (type === "video") {
        selector = types.videoTypes;
    } else if (type === "audio") {
        selector = types.audioTypes;
    } else if (type === "documents") {
        selector = types.documentTypes;
    } else if (type === "eaf") {
        selector = "eaf";
    } else if (type === "trs") {
        selector = "trs";
    } else if (type === "ixt") {
        selector = "ixt";
    } else if (type === "flextext") {
        selector = "flextext";
    }

    if (!isArray(tree["dcterms:tableOfContents"])) {
        tree["dcterms:tableOfContents"] = [tree["dcterms:tableOfContents"]];
    }
    var items = compact(
        tree["dcterms:tableOfContents"].map(d => {
            var i = d["#text"];
            var ext = i.split(".").pop();
            if (
                ext !== undefined &&
                selector !== undefined &&
                includes(selector, ext.toLowerCase())
            ) {
                return d["#text"];
            }
        })
    );

    if (includes(["audio", "video", "eaf", "trs", "ixt", "flextext"], type)) {
        // audio and video can exist in multiple formats; so, group the data
        //  by name and then return an array of arrays - sorting by item name
        return lodash(items)
            .chain()
            .groupBy(function(d) {
                return lodash.last(d.split("/")).split(".")[0];
            })
            .value();
    } else {
        return items;
    }
}

function generateThumbnails(images) {
    return images.map(d => {
        var name = d.split("/").pop();
        var thumbName =
            name.split(".")[0] + "-thumb-PDSC_ADMIN." + name.split(".")[1];
        return d.replace(name, thumbName);
    });
}

function generateAudioVisualisations(audio) {
    var audioVisualisations = lodash.map(audio, function(d) {
        var name = d[0].split("/").pop();
        var audioVisName = name.split(".")[0] + "-soundimage-PDSC_ADMIN.jpg";
        return d[0].replace(name, audioVisName);
    });
    audioVisualisations = lodash(audioVisualisations)
        .chain()
        .groupBy(function(d) {
            return d
                .split("/")
                .pop()
                .split(".")[0]
                .split("-soundimage")[0];
        })
        .value();

    lodash.each(audioVisualisations, function(d, i) {
        audioVisualisations[i] = d[0];
    });
    return audioVisualisations;
}

function groupByIdentifier(data) {
    let collections = groupBy(data, "collectionId");
    var ordered = {};
    lodash(collections)
        .keys()
        .sort()
        .each(function(key) {
            ordered[key] = collections[key];
        });

    return ordered;
}

function groupByGenre(data) {
    let genre;
    let collections = data.filter(item => item.data.classifications);
    collections = groupBy(collections, collection => {
        genre = collection.data.classifications.filter(c => c.genre)[0].genre;
        return genre;
    });
    var ordered = {};
    lodash(collections)
        .keys()
        .sort()
        .each(function(key) {
            ordered[key] = collections[key];
        });

    return ordered;
}

function groupBySpeaker(data) {
    let collectionsBySpeaker = {};
    let speakers, roles, speakerRole;
    let collections = data.filter(item => item.data.classifications);
    collections.forEach(collection => {
        roles = collection.index.speakerRoles;
        speakers = collection.data.speakers.filter(speaker =>
            includes(roles, speaker.role)
        );
        speakers.forEach(speaker => {
            speakerRole = `${speaker.name} (${speaker.role})`;
            if (!collectionsBySpeaker[speakerRole])
                collectionsBySpeaker[speakerRole] = [];
            collectionsBySpeaker[speakerRole].push(collection);
        });
    });
    var ordered = {};
    lodash(collectionsBySpeaker)
        .keys()
        .sort()
        .each(function(key) {
            ordered[key] = collectionsBySpeaker[key];
        });

    return ordered;
}
