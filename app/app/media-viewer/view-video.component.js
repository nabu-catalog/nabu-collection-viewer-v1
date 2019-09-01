"use strict";

const { isEmpty, keys, each } = require("lodash");

module.exports = {
    template: require("./view-media.component.html"),
    bindings: {},
    controller: Controller,
    controllerAs: "vm"
};

Controller.$inject = [
    "$state",
    "$rootScope",
    "dataService",
    "$timeout",
    "$location"
];
function Controller($state, $rootScope, dataService, $timeout, $location) {
    var vm = this;

    var broadcastListener;

    vm.$onInit = init;
    vm.$onDestroy = destroy;
    vm.previousItem = previousItem;
    vm.nextItem = nextItem;

    function init() {
        broadcastListener = $rootScope.$on("item data loaded", loadItem);
        vm.config = {
            current: 0,
            item: null,
            showItemInformation: false
        };
        loadItem();
    }

    function destroy() {
        broadcastListener();
    }

    function loadItem() {
        const collectionId = $state.params.collectionId;
        const itemId = $state.params.itemId;
        vm.showMedia = false;
        vm.loadingData = true;
        dataService.getItem(collectionId, itemId).then(processResponse);

        function processResponse(resp) {
            vm.loadingData = false;
            if (isEmpty(resp)) {
                return;
            }
            vm.item = resp;
            if (isEmpty(vm.item.video)) {
                return $state.go("main");
            }

            vm.video = vm.item.video.map(m => m.name);
            vm.totalItems = vm.item.video.length;

            if (!$state.params.videoId) {
                $location.search({});
                $state.go("main.video.instance", { videoId: vm.video[0] });
            }
            $timeout(() => {
                const videoId = $state.params.videoId;
                vm.config.current = vm.video.indexOf(videoId);
                vm.config.item = vm.item.video[vm.config.current];
            });
        }
    }

    function jump() {
        each(vm.video, (item, idx) => {
            if (vm.config.current === idx) {
                $location.search({});
                vm.config.item = null;
                $timeout(() => {
                    vm.config.item = vm.item.video[vm.config.current];
                    $state.go("main.video.instance", { videoId: item });
                });
            }
        });
    }

    function nextItem() {
        if (vm.config.current === vm.item.video.length - 1) {
            return;
        }
        vm.config.current += 1;
        jump();
    }

    function previousItem() {
        if (vm.config.current === 0) {
            return;
        }
        vm.config.current -= 1;
        jump();
    }
}
