// When user clicks on the map
$(".imap").on("click", function(e){
    e.preventDefault();
    updateGraph(e.target.id);
});

// ----------------------------------
// MAIN GRAPH & INFOBOX FUNCTION
// ----------------------------------
function updateGraph(selected_gal) {
	var hold = false; //to use for fade
	// ----------------------------------
	// PREPARE GRAPH FOR UPDATE
	// ----------------------------------

	// Clear all information from the graph
	d3.selectAll("#svg1 > *").remove();
    polys = d3.selectAll("polygon");
    polys.style("opacity", 0);

	// Puts placeholders in the DOM:

	// radius/width/height for the the outer circle
	var r = 420, w = r*2.07, h = r*2;

	// SVG for outer circle
	var svg = d3.select('#svg1')
		.attr("width",w).attr("height",h)
	    .append('g').attr('transform', 'translate(' + r*1.06 + ',' + r + ')');

	// SVG for inner circle
	var svg2 = d3.select('#svg1').append('svg') //Inner circle
	    .attr('id', 'group2')
	    .attr('width', w).attr('height',h)
	    .append('g').attr('transform', 'translate(' + r*1.06 + ',' + r + ')');

	// DOM references for use on mouseover
	infobox = d3.select('#infobox');
	rwgal = d3.select('#rwgal');

	// ----------------------------------
	// PREPARE STATIC DATA (GALLERY NODES)
	// ----------------------------------
	// Gallery nodes
	// create nodes from list
	galkeys=["16c Italian  French  & Spanish", "13c to 16c Italian", "19c French", "Special Exhibitions", "American", "British", "18c to early 19c French", "18c & 19c Spanish", "17c Dutch & Flemish", "15c to 16c Netherlandish & German", "17c to 18c Italian  French  & Spanish"];
	gallery_nodes = [];
	for (g in galkeys) {gallery_nodes.push({"id":galkeys[g], "galsort":parseInt(g)});};
	gallery_nodes.sort(function(x, y){return d3.ascending(x.galsort, y.galsort);});

	// add x,y coordinates of gallery node centers
	var interval = 360/gallery_nodes.length;
	for (i = 0; i < gallery_nodes.length; i++) {
	  gallery_nodes[i]['x']=((r*.35) * Math.cos(((interval*i)-140) * Math.PI/180))
	  gallery_nodes[i]['y']=((r*.35) * Math.sin(((interval*i)-140) * Math.PI/180))
	}

	// ----------------------------------
	// LOAD DATA & POPULATE GRAPH
	// ----------------------------------
	d3.json('data.json', (error, graph) => {
		if (error) throw error;
		// ----------------------------------
		// PREPARE DATA
		// ----------------------------------
		// Artwork nodes
		nodes = graph.nodes;

		// filter nodes to selected gallery
		nodes1 = nodes.filter(d=>d.gallery==selected_gal)

		// Aggregate data to level of artist
		// rollup by artist w/ maximum iconicity of their artworks
		var artists_focus = d3.nest()
		  .key(d=>d.artist)
		  .rollup(v=>d3.max(v, d=>d.iconicity))
		  .object(nodes1);

		// array of artists sorted by iconicity
		artists1 = d3.entries(artists_focus).sort((a,b) => b.value - a.value);

		// artist radial center locations
		var rad = Math.PI/180, interval = 360/artists1.length;
		for (i = 0; i < artists1.length; i++) {
		  artists1[i]['x']=((r*.6) * Math.cos(((interval*i)-90) * Math.PI/180))
		  artists1[i]['y']=((r*.6) * Math.sin(((interval*i)-90) * Math.PI/180))
		}

		// create artist center locations lookup
		artists1_centers={}
		artists1.forEach(function(d) {
		  artists1_centers[d.key] = {"x":d.x,"y":d.y, "iconicity":d.value}
		});

		// Update artwork nodes data w/ artist info
		nodes1.sort(function(x, y){return d3.descending(x.iconicity, y.iconicity);});
		for (n of nodes1) {
			    artists1_centers[n.artist].x += (artists1_centers[n.artist].x/300)*-5
			    artists1_centers[n.artist].y += (artists1_centers[n.artist].y/300)*-5
				n.x = artists1_centers[n.artist].x;
				n.y = artists1_centers[n.artist].y;
		}

		//Prepare links data
		// create base links lists
		links = graph.links;
		links_gallery = [];
		links_galonly = [];
		// gallery node arrays that are linked to selected node
		links_galnodes = {}
		for (k of galkeys) {links_galnodes[k]=[]};
	    nodesMap = d3.map();
		nodes.forEach(n => nodesMap.set(n.id, n));

		for (l of links) {
			link = {}
		    s = nodesMap.get(l.source);
		    t = nodesMap.get(l.target);
		    if (typeof(s) != "undefined" & typeof(t) != "undefined") {
				// defines selected gallery artwork as first in the link, target gallery as second
				if(s.gallery==selected_gal) {link["sel"]=s.id}
					else {link["gal"]=s.gallery;};
				if(t.gallery==selected_gal) {link["sel"]=t.id}
					else {link["gal"]=t.gallery;};

				// adds links from artworks that are both in selected gallery
				if(s.gallery==selected_gal & t.gallery==selected_gal) {
				  		links_gallery.push([s.id, t.gallery,1])
				  		links_gallery.push([t.id, s.gallery,1])
				}
				else { // add links between other galleries
					if (s.gallery!=selected_gal & t.gallery!=selected_gal) {
						if (s.gallery!=t.gallery) {links_galonly.push([s.gallery, t.gallery,1])};
					}
					else { // add links from an artwork to a gallery (& between the selected gallery and the target gallery)
						links_gallery.push([link.sel, link.gal,1]);
						links_galonly.push([s.gallery, t.gallery,1]);
						links_galnodes[s.gallery].push(s);
						links_galnodes[t.gallery].push(t);
					};
				};
			};
		};

		// make sure gallery nodes linked to selected gallery is unique
		for (k of galkeys) {links_galnodes[k]=Array.from(new Set(links_galnodes[k]))};

		// aggregate links lists
		function agg_links(links_data) {
			return d3.nest()
		        .key(d=>[d[0],d[1]])
		        .rollup(function(z) {return d3.sum(z, d=>d[2]);})
		        .entries(links_data)
		        .map(function (d) {
		            var val = d.key.split(',');
		            return {source: val[0], target: val[1], value: d.value};
		        });
		};
		links_nest = agg_links(links_gallery);
		links_allnest = agg_links(links_galonly);

		// ----------------------------------
		// GRAPHICS
		// ----------------------------------
		// Color scale for galleries
		colors = d3.scaleOrdinal()
			.range([d3.rgb(250,201,206), //"16c Italian  French  & Spanish"
				d3.rgb(253,231,228), //"13c to 16c Italian"
				d3.rgb(162,218,220), //"19c French"
				d3.rgb(253,236,171), //"Special Exhibitions"
				d3.rgb(245,134,112), //"American"
				d3.rgb(5,163,167), //"British"
				d3.rgb(89,198,200), //"18c to early 19c French"
				d3.rgb(248,191,19), //"18c & 19c Spanish"
				d3.rgb(185,217,186), //"17c Dutch & Flemish"
				d3.rgb(124,192,131), //"15c to 16c Netherlandish & German"
				d3.rgb(246,171,170)]) //"17c to 18c Italian  French  & Spanish"
	  		.domain(galkeys);

		// Iconicity scale
		const drange = d3.extent(nodes, d => d.iconicity);
		const rscale = d3.scaleSqrt().range([5, 20]).domain(drange);

	  	// Update legend
	  	// current gallery legend
	  	d3.select("#legcurgal")
	  		.attr("fill",colors(selected_gal))
	  		.attr("stroke",colors(selected_gal).darker(3));
	  	d3.select("#legcurgalt").text(selected_gal);
	  	d3.selectAll(".legrect")
	  		.attr("fill",colors(selected_gal))
	  		.attr("stroke",colors(selected_gal).darker(3));

	  	// map display outline
	    num=galkeys.indexOf(selected_gal)+1;
	  	d3.select("#msvg"+num).attr("stroke",colors(selected_gal).darker(3));
   	 	d3.select('#msvg'+num).style("opacity", 1);

		// current gallery title
		//d3.select('#ngamap')
			//.html('Current Gallery: <text style="color: '+colors(selected_gal)+'"> '+ selected_gal+'</text>')

		// Links: add first so that nodes go on top
		// links between outercircle and inner circle
		var linksG = svg.append("g")
		    .attr("class","links").selectAll("line.link")
		    .data(links_nest, d => `${d.source.id}_${d.target.id}`)
		    .enter().append("line")
		      .attr("class", "link")
		      .attr("stroke", d=> d3.hsl(colors(d.target)).darker(0.36))
		      .attr("stroke-opacity", 0.5)
		      .attr("stroke-width", d=>(d.value*0.5));

		// links between galleries: note-- not displaying this
		var linksallG = svg.append("g")
		    .attr("class","links").selectAll("line.link")
		    .data(links_allnest)
		    .enter().append("line")
		      .attr("class", "link")
		      .attr("stroke", d3.hsl("black").brighter(2))
		      .attr("stroke-width", d=>(d.value*.1))
		      .attr("stroke-opacity", 0);

		// Artwork nodes
		// creates containers for rects
		var nodes1G = svg.append("g")
		    .attr("class", "nodes")
		    .selectAll('.node')
		      .data(nodes1)
		      .enter().append('g')
		      .attr("class","node");

		// draws containers for rects
		var nodes1C = nodes1G.append('rect')
			.attr("id", d=>d.id)
			.attr("stroke", colors(selected_gal).darker(3))
			.attr("fill", d=>colors(d.gallery))
			.attr("width",d=>rscale(d.iconicity))
    		.attr("height",d=>rscale(d.iconicity))
			.attr("cx", d=> d.x)
			.attr("cy", d=> d.y)
			.on("mouseover", mouseon(.1))
			.on("mouseout", mouseoff(1))
			.on("click", function() {});

		// sets animation for artwork nodes
		var simulation = d3.forceSimulation(nodes1)
		    .force("charge", d3.forceManyBody().strength(-0.4))
		    .on('tick', ticked);

		// titles and labels
		nodes1C.append("title").text(d=>d.title);
		labels1 = nodes1G.append("text").text(d=>d.title); // note-- not displaying this


		// Artist labels
		interval = Math.PI * 2 / artists1.length;
		artistlabels = svg.append("g")
		.attr("class", "artists")
		    .selectAll('text')
		      .data(artists1)
		      .enter().append("text")
		      	.attr("text-anchor", "middle")
		      	.text(function (d) {
		      		lkey = d.key.length
		      		if (lkey<=16) {tx = d.key.substring(0, 16)}
		      		else {tx = d.key.substring(0, 16)+'...'};
		      		return tx;
		      	})
				.attr("transform", function(d,i) {
					i2=i;
		     		var rotate = interval * i > Math.PI ? (interval * i2 * 180 / Math.PI) - 270 : (interval * i2 * 180 / Math.PI) - 90;
					tx=d.x+((d.x/300)*15)
					ty=d.y+((d.y/300)*15)
					return "translate(" + tx + "," + ty + ") rotate(" + rotate + ")"
				})
				.attr("text-anchor",function(d){if (d.x<0) {return "end"}});

        artistlabels.append("title").text(d=>d.key);

		// Gallery nodes
		// creates container
		var nodes2G = svg2.append("g")
		    .attr("class", "nodes")
		    .selectAll('.node')
		      .data(gallery_nodes)
		      .enter().append('g')
		      .attr("class","node");

		// draws circle
		var nodes2C = nodes2G.append('circle')
			.attr("class", "galcircles")
			.attr("id", d=>d.id)
			.attr("fill", d=>colors(d.id))
			.attr('r', 20)
			.attr("cx", d=> d.x)
			.attr("cy", d=> d.y)
			.attr("stroke-opacity",0.8)
			.attr("stroke-width", function (d) {
				if (d.id==selected_gal) {return 3}
				else {return 1};
			})
			.attr("stroke", function(d) {
				if (d.id==selected_gal) {return colors(d.id).darker(3)}
				else {return colors(d.id).darker(1)}
			})
			.on("mouseover", mouseon(.1))
			.on("mouseout", mouseoff(1));

		// labels
		labels2 = svg2.append("g")
		.attr("class", "galleries")
		    .selectAll('text')
		      .data(gallery_nodes)
		      .enter().append("text")
		      	.attr("text-anchor", "middle")
		      	.text(d=>d.id)
		      		.attr("transform", d=>"translate(" + d.x + "," + d.y + ")")
					.attr("cx", d=>d.x)
					.attr("cy", d=>d.y);

		// SVG onhold
		d3.select('#svg1').on("click", function() {hold=!hold});


		// ----------------------------------
		// FUNCTIONS
		// ----------------------------------
		function ticked() { //recenters node groups around circle
		  nodes1G
		  	.attr("transform", d=> "translate(" + d.x + "," + d.y + ")");

		  labels1
		      .attr("cx", d=>d.x)
		      .attr("cy", d=>d.y)
		      .attr("dx", 8)
		      .attr("dy", 10);
		  if (simulation.alpha() < 0.08) {simulation.stop(); return updateLinks();}
		}

		function updateLinks()  { // enter/exit display for links
			// Update (x,y) of reference nodes in links data
			// node maps
		    nodesMap2 = d3.map();
		    nodes.forEach(n => nodesMap2.set(n.id, n));
		    nodesMap3 = d3.map();
		    gallery_nodes.forEach(n => nodesMap3.set(n.id, n));

			// links between artworks
		    links.forEach(function(l) {
		      l.source = nodesMap2.get(l.source);
		      l.target = nodesMap2.get(l.target);
		      if (typeof(l.source) != "undefined" & typeof(l.target) != "undefined") {return linkedByID[`${l.source.id},${l.target.id}`] = 1; //to be use for fade
		      }
		    });

		    // links between selected artworks and galleries
		    links_nest.forEach(function(l) {
		      ls = nodesMap2.get(l.source);
		      if (typeof(ls) =="undefined") {ls=nodesMap3.get(l.source);}
		      l.source=ls;
		      l.target = nodesMap3.get(l.target);
		      if (typeof(l.source) != "undefined" & typeof(l.target) != "undefined") {return linkedByID[`${l.source.id},${l.target.id}`] = 1;}
		    });

		    // links between galleries
		    links_allnest.forEach(function(l) {
		      ls = nodesMap2.get(l.source);
		      if (typeof(ls) =="undefined") {ls=nodesMap3.get(l.source);}
		      l.source=ls;
		      l.target = nodesMap3.get(l.target);
		      if (typeof(l.source) != "undefined" & typeof(l.target) != "undefined") {return linkedByID[`${l.source.id},${l.target.id}`] = 1;}
		    });

		    // Update link location on graph (draws links)
		    linksG
		        .attr("x1", d => d.source.x)
		        .attr("y1", d => d.source.y)
		        .attr("x2", d => d.target.x)
		        .attr("y2", d => d.target.y);

		    linksallG
		        .attr("x1", d => d.source.x)
		        .attr("y1", d => d.source.y)
		        .attr("x2", d => d.target.x)
		        .attr("y2", d => d.target.y);
		};

		// Functions to highlight neighboring nodes and links
		const linkedByID = {};
		const linkedByID2 = {};
		function isConnected(a, b) {return linkedByID[a.id + "," + b.id] || linkedByID[b.id + "," + a.id] || a.id == b.id;}
		function isConnected2(a, b) {return linkedByID[a.id + "," + b.id] || linkedByID[b.id + "," + a.id];}
		function mouseon(opacity) {return fade(opacity,1);};
		function mouseoff(opacity) {return fade(opacity,0);};
		function fade(opacity, on) {

	   		return function(d) {
	   			if (hold!=true) {
					// ----------------------------------
					// LABELS/GRAPHICS OF NODES
					// ----------------------------------
			    	// Starts list of artists linked to node
			    	artistscon = [d.artist]

				    // Artwork node opacity
			        nodes1C.style("opacity", function(o) {
			            thisOpacity = isConnected(d, o) ? 1 : opacity;
			            if (thisOpacity==1) {artistscon.push(o.artist)};
			            return thisOpacity;
			        });

			        // Artist label opacity
			        artistlabels.attr("opacity", o=> artistscon.indexOf(o.key)>=0 ? 1 : opacity);

			        // Gallery node opacity
			        nodes2G.style("opacity", o=> isConnected(d, o) ? 1 : opacity);

			        // Gallery label opacity
			        labels2.style("opacity", o=> isConnected(d, o) ? 1 : opacity);

			        // Links (outer to inner circle) opacity
			        linksG.style("stroke-opacity", function(o) {return o.source === d || o.target === d ? 1 : opacity*0.5;});

			        // labels1.style("display", function(o) {if (isConnected(d, o) == 1 & on==1) {display = "inline";} else {display = ""}; return display;});
					// ----------------------------------
					// INFOBOX & RELATED WORKS
					// ----------------------------------
			    	if (on==1) {
				    	//Update infobox w/ selected work
				    	if (typeof d.title !== 'undefined') {
				    		infobox.select('#infoh').html('Selected Work');
				    		infobox.select('#rwh2').html('<h2>Related Works</h2><text id="sorted"></text>');
				    		infobox.select('#infotitle').html(d.title+' <text id="infodate">['+d.date+']</text>'+'<text id="infoartist"> '+d.artist+'</text>');
				    		infobox.select('#infoimg').html('<img src='+d.thumbnail_link+' alt="related image"' + '" style="border-color:'+colors(d.gallery)+'"'+'>');
				    	}
				    	else {
				    		if (d.id!=selected_gal) {
	                            infobox.select('#infoh').html('<h2><text style="background-color:'+colors(d.id)+'">Works in <i>'+d.id+'</i> related to works in <i>'+selected_gal+'</i></text></h2><text id="sorted"></text>')
	                            // infobox.select('#infoh').html('<h2><text style="background-color:'+colors(d.id)+'">'+d.id+' Gallery </text><text style="background-color:'+colors(selected_gal)+'">'+'Related Works in Current Gallery</text></h2><text id="sorted"></text>')
				    		}
				    		else {
	                            infobox.select('#infoh').html('<h2><text style="background-color:'+colors(d.id)+'"> All works in <i>'+d.id+'</i></text></h2><text id="sorted"></text>')
	                            // infobox.select('#infoh').html('<h2> Works Related to Another Work in the <text style="background-color:'+colors(d.id)+'">Current Gallery</text></h2><text id="sorted"></text>')
	                        };
				    		infobox.select('#infotitle').html('<div style="display:none"></div>');
				    		infobox.select('#infoimg').html('<div style="display:none"></div>');
				    		infobox.select('#rwh2').html('<div style="display:none"></div>');
				    	};

				    	// Prepare related works data
				        rel_nodes = [];
				        for (n of nodes) {if (isConnected2(d, n)==1) {rel_nodes.push(n)};};
				        if (d.id===selected_gal) {rel_nodes = nodes.filter(d=>d.gallery==selected_gal)} // related works filtered to only current gallery if node is the selected gallery node
				    	else if (galkeys.indexOf(d.id)>=0) {rel_nodes = links_galnodes[d.id];}; // related works filtered to only current gallery if node is the selected gallery node
				        rel_nodes.sort((a,b) => a.galsort - b.galsort || b.iconicity - a.iconicity); // sort by gallery and then iconicity (high to low)

				        // Update related works graphics
				        rwgal.selectAll('gal').remove();
				      	for (i = 0; i < 11; i++) {
				      		rel_nodes_i = rel_nodes.filter(d=>d.galsort === i);

				      		// add gallery
				      		if (rel_nodes_i.length>0) {
					      		gal = rwgal.append('gal')
					      			.attr('class','gal')
					      			.html( function() {
					      				if (d.id===selected_gal) {return ''}
					      				else if (galkeys.indexOf(d.id)>=0)  {return ''}
					      				else {return '<h1'+' style="background-color:'+colors(rel_nodes_i[0].gallery)+'"'+'>'+gallery_nodes[i].id+'</h1>'};
					      			});

						        // join
						        var rws = gal.selectAll('rw'+i)
						        	.data(rel_nodes_i)

						        // exit
						        rws.exit().remove();

						        // update
						        rws
						           .html((z) =>
						           	'<div class = "gallery"><div class="frames"><img src='+
						           	z.thumbnail_link+' alt="image of '+z.title+
						           	'" style="border-color:'+colors(z.gallery)+'"'+'></div><div class="notes"><n class=rwtitle>'+z.title+
						           	'</n><n class=rwsubt>'+z.artist+'</n><n class=rwsubt>'+z.date+
						           	'</n></div></div>');

						       	//enter
						       	rws.enter()
						       		.append("rw"+i)
						       		.attr("class", "relwork")
						           .html((z) =>
						           	'<div class = "gallery"><div class="frames"><img src='+
						           	z.thumbnail_link+' alt="image of '+z.title+
						           	'" '+'></div><div class="notes"><n class=rwtitle>'+z.title+
						           	'</n><n class=rwsubt>'+z.artist+'</n><n class=rwsubt>'+z.date+
						           	'</n></div></div>');
						    };
						};
				    };
				};
			};
		};
	});
};

// ----------------------------------
// POPULATE THE LEGEND
// ----------------------------------
leg = d3.select('#legend').append('svg')
	.attr("id","legsvg");

// Selected Gallery
sy = 30
leg.append("text")
	.attr("class","legmain")
	.text("Selected gallery:")
	.attr("x",5)
	.attr("y",sy+5)
leg.append('circle')
.attr('id','legcurgal')
.attr('r',15)
.attr("fill", "gray")
.attr("cx", 130)
.attr("cy", sy)
.attr("stroke-width",3)
.attr("stroke","black");
leg.append("text")
	.attr("id","legcurgalt")
	.attr("class","legsub")
	.text("")
	.attr("x",150)
	.attr("y",sy+5)

// Artwork
sy = sy+60
sx = 6
s1 = 120
leg.append("text")
	.attr("class","legmain")
	.text("Artwork iconicity:")
	.attr("x",5)
	.attr("y",sy+5);

leg.append('rect')
.attr('class','legrect')
.attr('width',sx)
.attr('height',sx)
.attr("fill", "gray")
.attr("stroke-width",0.5)
.attr("stroke","black")
.attr("x", s1+sx)
.attr("y", sy)

leg.append('rect')
.attr('class','legrect')
.attr('width',sx*2)
.attr('height',sx*2)
.attr("fill", "gray")
.attr("stroke-width",0.5)
.attr("stroke","black")
.attr("x", s1+sx*3)
.attr("y", sy-sx/2)

leg.append('rect')
.attr('class','legrect')
.attr('width',sx*3)
.attr('height',sx*3)
.attr("fill", "gray")
.attr("stroke-width",0.5)
.attr("stroke","black")
.attr("x", s1+sx*6)
.attr("y", sy-sx)

leg.append('rect')
.attr('class','legrect')
.attr('width',sx*3.5)
.attr('height',sx*3.5)
.attr("fill", "gray")
.attr("stroke-width",0.5)
.attr("stroke","black")
.attr("x", s1+sx*10)
.attr("y", sy-sx*1.2)

// Links
s1 = 120
sy = sy+50
leg.append("text")
	.attr("class","legmain")
	.text("Number of related")
	.attr("x",5)
	.attr("y",sy+10);
leg.append("text")
	.attr("class","legmain")
	.text("artworks:")
	.attr("x",5)
	.attr("y",sy+25);

leg.append('line')
.attr('x1',s1+10)
.attr('y1',sy)
.attr('x2',s1+10)
.attr('y2',sy+30)
.attr('stroke-width',1)
.attr("stroke","black");

leg.append('line')
.attr('x1',s1+20)
.attr('y1',sy)
.attr('x2',s1+20)
.attr('y2',sy+30)
.attr('stroke-width',2)
.attr("stroke","black");

leg.append('line')
.attr('x1',s1+30)
.attr('y1',sy)
.attr('x2',s1+30)
.attr('y2',sy+30)
.attr('stroke-width',3)
.attr("stroke","black");

leg.append('line')
.attr('x1',s1+40)
.attr('y1',sy)
.attr('x2',s1+40)
.attr('y2',sy+30)
.attr('stroke-width',4)
.attr("stroke","black");

// Populate the graph on open
updateGraph("19c French");
