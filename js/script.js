const datasets = {
    "penguins": "/datasets/penguins_cleaned.csv",
    "pokemon": "/datasets/Pokemon.csv",
    "Test1": "/datasets/testing/data/Test1.csv",
    "Test2": "/datasets/testing/data/Test2.csv"
};
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
let currentData = null;
let quantitativeAttributes = [];
let categoricalAttributes = [];
let selectedPoints = [];
let isBoxPlot = true;
function init() {
    const datasetSelect = document.getElementById('dataset-select');
    const xAttributeSelect = document.getElementById('x-attribute-select');
    const yAttributeSelect = document.getElementById('y-attribute-select');
    const colorSelect = document.getElementById('color-select');
    const boxplotSelect = document.getElementById('boxplot-select');
    const plotTypeSelect = document.getElementById('plot-type-select'); 
    if (!datasetSelect || !xAttributeSelect || !yAttributeSelect || !colorSelect || !boxplotSelect || !plotTypeSelect) {
        console.error("One or more required elements are missing from the HTML");
        return;
    }
    Object.keys(datasets).forEach(key => {
        const option = document.createElement('option');
        option.value = datasets[key];
        option.text = key.charAt(0).toUpperCase() + key.slice(1);
        datasetSelect.add(option);
    });
    datasetSelect.addEventListener('change', () => loadDataset(datasetSelect.value));
    xAttributeSelect.addEventListener('change', updateScatterPlot);
    yAttributeSelect.addEventListener('change', updateScatterPlot);
    colorSelect.addEventListener('change', updateScatterPlot);
    boxplotSelect.addEventListener('change', updateBoxPlot);
    plotTypeSelect.addEventListener('change', updateBoxPlot); 
    loadDataset(datasets["penguins"]);
}

function loadDataset(datasetUrl) {
    d3.csv(datasetUrl).then(data => {
        currentData = data;
        const attributes = Object.keys(data[0]);
        quantitativeAttributes = attributes.filter(attr => !isNaN(parseFloat(data[0][attr])));
        categoricalAttributes = attributes.filter(attr => isNaN(parseFloat(data[0][attr])));
        updateDropdown('x-attribute-select', quantitativeAttributes);
        updateDropdown('y-attribute-select', quantitativeAttributes);
        updateDropdown('color-select', categoricalAttributes);
        updateDropdown('boxplot-select', quantitativeAttributes);
        updateScatterPlot();
        document.addEventListener('DOMContentLoaded', function() {
            updateBoxPlot(); 
        });
    }).catch(error => {
        console.error("Error loading the dataset:", error);
    });
}

function updateDropdown(selectId, attributes) {
    const selectElement = document.getElementById(selectId);
    selectElement.innerHTML = '';
    attributes.forEach(attr => {
        const option = document.createElement('option');
        option.value = attr;
        option.text = attr;
        selectElement.add(option);
    });
}

function updateScatterPlot() {
    const xAttr = document.getElementById('x-attribute-select').value;
    const yAttr = document.getElementById('y-attribute-select').value;
    const colorAttr = document.getElementById('color-select').value;
    if (!xAttr || !yAttr || !colorAttr || !currentData) return;
    const svg = d3.select('.scatter-plot').selectAll('svg').data([null]);
    const plotSvg = svg.enter().append('svg')
        .attr('width', 600)
        .attr('height', 400)
        .merge(svg);
    const xScale = d3.scaleLinear()
        .domain(d3.extent(currentData, d => +d[xAttr]))
        .range([50, 550]);
    const yScale = d3.scaleLinear()
        .domain(d3.extent(currentData, d => +d[yAttr]))
        .range([350, 50]);
    plotSvg.selectAll('g.axis').remove();
    plotSvg.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,350)')
        .call(d3.axisBottom(xScale));
    plotSvg.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(50,0)')
        .call(d3.axisLeft(yScale));
    const circles = plotSvg.selectAll('circle')
        .data(currentData, d => d.id);
    circles.transition()
        .duration(1000)
        .attr('cx', d => xScale(+d[xAttr]))
        .attr('cy', d => yScale(+d[yAttr]));
    circles.enter().append('circle')
        .attr('cx', d => xScale(+d[xAttr]))
        .attr('cy', d => yScale(+d[yAttr]))
        .attr('r', 5)
        .attr('fill', d => colorScale(d[colorAttr]))
        .attr('class', 'data-point')
        .attr('id', (d, i) => `dot-${i}`)
        .style('opacity', 0)
        .transition()
        .duration(1000)
        .style('opacity', 1);
    circles.exit()
        .transition()
        .duration(1000)
        .style('opacity', 0)
        .remove();
    addLasso(plotSvg, plotSvg.selectAll('circle'), xScale, yScale, xAttr, yAttr);
    plotSvg.selectAll(".x-axis-label").remove();
    plotSvg.selectAll(".y-axis-label").remove();
    plotSvg.append("text")
        .attr("class", "x-axis-label")
        .attr("x", 300)
        .attr("y", 390)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(xAttr);
    plotSvg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -200)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(yAttr);
        updateColorKey(colorAttr, colorScale);
}

function updateColorKey(colorAttr, colorScale) {
    const colorValues = Array.from(new Set(currentData.map(d => d[colorAttr])));
    const colorKey = d3.select('#color-key');
    colorKey.html('');
    colorValues.forEach((value, index) => {
        const colorBox = colorKey.append('div')
            .style('display', 'inline-flex')
            .style('align-items', 'center')
            .style('margin-right', '8px');
        colorBox.append('span')
            .style('width', '16px')
            .style('height', '16px')
            .style('background-color', colorScale(value))
            .style('display', 'inline-block')
            .style('margin-right', '5px');
        colorBox.append('span').text(value);
    });
}

function addLasso(svg, circles, xScale, yScale, xAttr, yAttr) {
    let coords = [];
    let drawingLasso = false;
    const lineGenerator = d3.line();
    let lassoPath;
    const pointInPolygon = (point, vs) => {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const [xi, yi] = vs[i], [xj, yj] = vs[j];
            const intersect = (yi > point[1]) !== (yj > point[1]) &&
                point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    };
    function drawPath() {
        if (!lassoPath) {
            lassoPath = svg.append("path")
                .attr('class', 'lasso')
                .style("fill", "#8c9eff")
                .style("fill-opacity", 0.5)
                .style("stroke", "blue")
                .style("stroke-width", 2);
        }
        lassoPath.attr("d", lineGenerator(coords));
    }
    function dragStart(event) {
        coords = [d3.pointer(event, svg.node())];
        drawingLasso = true;
        drawPath();
    }
    function dragMove(event) {
        if (!drawingLasso) return;
        coords.push(d3.pointer(event, svg.node()));
        drawPath();
    }
    function dragEnd() {
        drawingLasso = false;
        const selected = [];
        circles.each(function (d) {
            const cx = xScale(+d[xAttr]);
            const cy = yScale(+d[yAttr]);
            if (pointInPolygon([cx, cy], coords)) {
                selected.push(d);
                d3.select(this).classed('selected-point', true);
            } else {
                d3.select(this).classed('selected-point', false);
            }
        });
        selectedPoints = selected;
        if (selectedPoints.length > 0) {
            displaySelectedPoints(selected, xAttr, yAttr);
            updateBoxPlot();
        }
    }
    const drag = d3.drag()
        .on("start", dragStart)
        .on("drag", dragMove)
        .on("end", dragEnd);
    svg.call(drag);
    function preserveLasso() {
        if (coords.length > 0) drawPath();
    }
    function resetLasso() {
        if (lassoPath) {
            lassoPath.remove();
            lassoPath = null;
        }
        coords = [];
        circles.classed('selected-point', false);
        document.getElementById('selected-points-list').innerHTML = '';
    }
    document.getElementById('plot-type-select').addEventListener('change', () => {
        setTimeout(() => {
            preserveLasso();
            resetLasso();
        }, 0);
    });
    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', resetLasso);
    });
}

function displaySelectedPoints(selectedPoints) {
    const selectedList = document.getElementById('selected-points-list');
    selectedList.innerHTML = '';
    if (selectedPoints.length > 0) {
        const countItem = document.createElement('b');
        countItem.textContent =`Points Selected: ${selectedPoints.length}`;
        selectedList.appendChild(countItem);
    } else {
        selectedList.innerHTML = '<b>No points selected</b>';
    }
}

function togglePlotType() {
    isBoxPlot = !isBoxPlot;
    updateBoxPlot();
}

function updateBoxPlot() {
    const plotType = document.getElementById('plot-type-select').value;
    const boxplotAttr = document.getElementById('boxplot-select').value;
    const colorAttr = document.getElementById('color-select').value;
    let plotTitle = document.getElementById('plot-title');
    if (!plotTitle) {
        plotTitle = document.createElement('div');
        plotTitle.id = 'plot-title';
        document.querySelector('.box-plots').prepend(plotTitle);
    }
    plotTitle.textContent = plotType === 'box' ? 'Box Plot' : 'Violin Plot';
    plotTitle.style.fontSize = '18px';
    plotTitle.style.fontWeight = 'bold';
    plotTitle.style.marginBottom = '0px';
    plotTitle.style.color = '#555';
    if (!boxplotAttr || selectedPoints.length === 0 || !colorAttr) {
        console.warn("No data points selected or invalid attributes.");
        d3.select('.box-plots').selectAll('*').remove();
        return;
    }
    const groupedData = d3.group(selectedPoints, d => d[colorAttr]);
    const margin = { top: 10, right: 50, bottom: 160, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    const svg = d3.select('.box-plots').selectAll('svg').data([null]);
    const plotSvg = svg.enter().append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .merge(svg);
    plotSvg.selectAll('*').remove();
    const allValues = selectedPoints.map(d => +d[boxplotAttr]).filter(d => !isNaN(d));
    if (allValues.length === 0) {
        console.warn("No valid data values found for boxplot attribute.");
        return;
    }
    const yScale = d3.scaleLinear()
        .domain([d3.min(allValues) - 1, d3.max(allValues) + 1])
        .range([height, 0]);
    plotSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`)
        .call(d3.axisLeft(yScale).tickSize(-width))
        .selectAll('text')
        .style('font-size', '12px');
    const boxWidth = width / groupedData.size;
    let index = 0;
    const transitionDuration = 1000;
    plotSvg.selectAll(".whisker-line")
        .transition()
        .duration(transitionDuration)
        .style("opacity", 0)
        .remove();
    groupedData.forEach((data, group) => {
        const dataValues = data.map(d => +d[boxplotAttr]).filter(d => !isNaN(d));
        if (dataValues.length === 0) return;
        const xPos = margin.left + index * boxWidth;
        if (plotType === 'box') {
            const q1 = d3.quantile(dataValues, 0.25) ?? 0;
            const median = d3.quantile(dataValues, 0.5) ?? 0;
            const q3 = d3.quantile(dataValues, 0.75) ?? 0;
            const iqr = q3 - q1;
            const lowerWhisker = Math.max(d3.min(dataValues), q1 - 1.5 * iqr);
            const upperWhisker = Math.min(d3.max(dataValues), q3 + 1.5 * iqr);
            plotSvg.append('rect')
                .attr('x', xPos)
                .attr('y', yScale(q3) + margin.top)
                .attr('width', boxWidth - 10)
                .attr('height', Math.max(0, yScale(q1) - yScale(q3)))
                .attr('fill', colorScale(group))
                .transition()
                .duration(transitionDuration)
                .attr('opacity', 1);
            plotSvg.append('line')
                .attr('x1', xPos)
                .attr('x2', xPos + boxWidth - 10)
                .attr('y1', yScale(median) + margin.top)
                .attr('y2', yScale(median) + margin.top)
                .style('stroke', 'black')
                .style('stroke-width', 2)
                .transition()
                .duration(transitionDuration)
                .attr('opacity', 1);
            plotSvg.append("line")
                .attr("class", "whisker-line")
                .attr("x1", xPos + (boxWidth - 10) / 2)
                .attr("x2", xPos + (boxWidth - 10) / 2)
                .attr("y1", yScale(lowerWhisker) + margin.top)
                .attr("y2", yScale(q1) + margin.top)
                .attr("stroke", "black")
                .style("stroke-width", 2)
                .style("opacity", 0)
                .transition()
                .duration(transitionDuration)
                .style("opacity", 1);
            plotSvg.append("line")
                .attr("class", "whisker-line")
                .attr("x1", xPos + (boxWidth - 10) / 2)
                .attr("x2", xPos + (boxWidth - 10) / 2)
                .attr("y1", yScale(q3) + margin.top)
                .attr("y2", yScale(upperWhisker) + margin.top)
                .attr("stroke", "black")
                .style("stroke-width", 2)
                .style("opacity", 0)
                .transition()
                .duration(transitionDuration)
                .style("opacity", 1);
        } else if (plotType === 'violin') {
            const kde = kernelDensityEstimator(kernelEpanechnikov(0.1), yScale.ticks(40));
            const density = kde(dataValues);
            const xScale = d3.scaleLinear()
                .range([0, boxWidth / 2])
                .domain([0, d3.max(density, d => d[1])]);
            plotSvg.append('path')
                .datum(density)
                .attr('fill', colorScale(group))
                .attr('stroke', 'black')
                .attr('opacity', 0)
                .attr('d', d3.area()
                    .x0(xPos)
                    .x1(d => xPos + xScale(d[1]))
                    .y(d => yScale(d[0]) + margin.top)
                    .curve(d3.curveBasis)
                )
                .transition()
                .duration(transitionDuration)
                .attr('opacity', 0.6);
        }
        plotSvg.append("text")
            .attr("x", xPos + (boxWidth - 10) / 2)
            .attr("y", height + margin.top + 40)
            .attr("text-anchor", "middle")
            .attr("transform", `rotate(45, ${xPos + (boxWidth - 10) / 2}, ${height + margin.top + 40})`)
            .style("font-size", "12px")
            .text(group);
        index++;
    });
    plotSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", margin.left / 2 - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(boxplotAttr);
    plotSvg.append("text")
        .attr("x", width / 2 + margin.left)
        .attr("y", height + margin.top + margin.bottom - 60)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(colorAttr);
}

function kernelDensityEstimator(kernel, x) {
    return function (sample) {
        return x.map(function (x) {
            return [x, d3.mean(sample, function (v) { return kernel(x - v); })];
        });
    };
}

function kernelEpanechnikov(bandwidth) {
    return function (u) {
        return Math.abs(u /= bandwidth) <= 1 ? 0.75 * (1 - u * u) / bandwidth : 0;
    };
}
init();