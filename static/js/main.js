v = {
    data() {
        return {
            activeIndex: '1',
            activeIndex2: '1'
        };
    },
    mounted: function () {
        this.echartsInit();
    },
    methods: {
        handleSelect(key, keyPath) {
            console.log(key, keyPath);
        },
        handleOpen(key, keyPath) {
            console.log(key, keyPath);
        },
        handleClose(key, keyPath) {
            console.log(key, keyPath);
        },
        // Echarts
        echartsInit() {
            var ROOT_PATH = '../output/StarTrack-js.json';
            var chartDom = document.getElementById('main');
            var myChart = echarts.init(chartDom);
            var option;

            $.when(
                $.get(ROOT_PATH),
                $.getScript(
                    'https://cdn.jsdelivr.net/npm/d3-hierarchy@2.0.0/dist/d3-hierarchy.min.js'
                )
            ).done(function (res) {
                run(res[0]);
            });
            function run(rawData) {
                const dataWrap = prepareData(rawData);
                initChart(dataWrap.seriesData, dataWrap.maxDepth);
            }
            function prepareData(rawData) {
                const seriesData = [];
                let maxDepth = 0;
                function convert(source, basePath, depth) {
                    if (source == null) {
                        return;
                    }
                    if (maxDepth > 10) {
                        return;
                    }
                    maxDepth = Math.max(depth, maxDepth);
                    seriesData.push({
                        id: basePath,
                        value: source.$count,
                        color: source.$color,
                        url: source.$url,
                        sha: source.$sha,
                        depth: depth,
                        index: seriesData.length
                    });
                    for (var key in source) {
                        if (source.hasOwnProperty(key) && !key.match(/^\$/)) {
                            var path = basePath + '/' + key;
                            convert(source[key], path, depth + 1);
                        }
                    }
                }
                convert(rawData, 'Fyzhq', 0);
                return {
                    seriesData: seriesData,
                    maxDepth: maxDepth
                };
            }
            function initChart(seriesData, maxDepth) {
                var displayRoot = stratify();
                function stratify() {
                    return d3
                        .stratify()
                        .parentId(function (d) {
                            return d.id.substring(0, d.id.lastIndexOf('/'));
                        })(seriesData)
                        .sum(function (d) {
                            return d.value || 0;
                        })
                        .sort(function (a, b) {
                            return b.value - a.value;
                        });
                }
                function overallLayout(params, api) {
                    var context = params.context;
                    d3
                        .pack()
                        .size([api.getWidth() - 2, api.getHeight() - 2])
                        .padding(3)(displayRoot);
                    context.nodes = {};
                    displayRoot.descendants().forEach(function (node, index) {
                        context.nodes[node.id] = node;
                    });
                }
                function renderItem(params, api) {
                    var context = params.context;
                    // Only do that layout once in each time `setOption` called.
                    if (!context.layout) {
                        context.layout = true;
                        overallLayout(params, api);
                    }
                    var nodePath = api.value('id');
                    var node = context.nodes[nodePath];
                    if (!node) {
                        // Reder nothing.
                        return;
                    }
                    var isLeaf = !node.children || !node.children.length;
                    var focus = new Uint32Array(
                        node.descendants().map(function (node) {
                            return node.data.index;
                        })
                    );
                    var nodeName = isLeaf
                        ? nodePath
                            .slice(nodePath.lastIndexOf('/') + 1)
                            .split(/(?=[A-Z][^A-Z])/g)
                            .join('\n')
                        : '';
                    var z2 = api.value('depth') * 2;
                    return {
                        type: 'circle',
                        focus: focus,
                        shape: {
                            cx: node.x,
                            cy: node.y,
                            r: node.r
                        },
                        transition: ['shape'],
                        z2: z2,
                        textContent: {
                            type: 'text',
                            style: {
                                // transition: isLeaf ? 'fontSize' : null,
                                text: nodeName,
                                fontFamily: 'Arial',
                                width: node.r * 1.3,
                                overflow: 'truncate',
                                fontSize: node.r / 4
                            },
                            emphasis: {
                                style: {
                                    overflow: null,
                                    fontSize: Math.max(node.r / 4, 12)
                                }
                            }
                        },
                        textConfig: {
                            position: 'inside'
                        },
                        style: {
                            fill: api.visual('color'),
                            stroke: '#000000',
                            lineWidth: 1,
                        },
                        emphasis: {
                            style: {
                                fontFamily: 'Arial',
                                fontSize: 12,
                                // stroke: '#000000',
                                // lineWidth: 3,
                                shadowBlur: 20,
                                shadowOffsetX: 3,
                                shadowOffsetY: 5,
                                shadowColor: 'rgba(0,0,0,0.3)'
                            }
                        }
                    };
                }
                option = {
                    dataset: {
                        source: seriesData
                    },
                    tooltip: {},
                    hoverLayerThreshold: Infinity,
                    series: {
                        type: 'custom',
                        renderItem: renderItem,
                        progressive: 0,
                        coordinateSystem: 'none',
                        encode: {
                            tooltip: 'value',
                            itemName: 'id'
                        },
                        itemStyle: {
                            color: function (param) {
                                return param.data.color;
                            },
                            borderWidth: 5
                        },
                    }
                };
                myChart.setOption(option);
                myChart.on('click', { seriesIndex: 0 }, function (params) {
                    drillDown(params.data.id);
                    if (!params.event.topTarget.textConfig) {
                        console.log(seriesData[params.value.index])
                        window.open(seriesData[params.value.index].url)
                    }

                });
                function drillDown(targetNodeId) {
                    if (targetNodeId == undefined && displayRoot != undefined) {
                        let id = displayRoot.data.id.substring(0, displayRoot.data.id.length - 1)
                        let pos = displayRoot.data.id.lastIndexOf('/')
                        targetNodeId = displayRoot.data.id.substr(0, pos + 1)
                        targetNodeId = targetNodeId.substring(0, targetNodeId.length - 1)
                    }
                    if (targetNodeId != null) {
                        displayRoot = stratify();
                        displayRoot = displayRoot.descendants().find(function (node) {
                            return node.data.id === targetNodeId;
                        });
                    }
                    // A trick to prevent d3-hierarchy from visiting parents in this algorithm.
                    if (displayRoot != undefined) {
                        displayRoot.parent = null;
                        myChart.setOption({
                            dataset: {
                                source: seriesData
                            }
                        });
                    }
                }
                // Reset: click on the blank area.
                myChart.getZr().on('click', function (event) {
                    if (!event.target) {
                        drillDown();
                    }
                });
            }
            option && myChart.setOption(option);
            window.onresize = function () {
                myChart.resize();
            };
        }
    }
}
const V = Vue.createApp(v);
V.use(ElementPlus);
V.mount("#app");