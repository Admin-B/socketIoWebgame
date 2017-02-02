var gCanvas,
	gCtx,
	gWindow=$(window);
	
var gResourcePath="./resources";
var gImageSrc={
	"player.png":false
}; //filename : [false/true]
var gImages  = new Object();
var gImage   = new Object();
gCanvas       = document.getElementById('canvas');
gContainer   =$("#container");

gCanvas.width = gContainer.width();
gCanvas.height= gContainer.height();
gCtx          = gCanvas.getContext('2d');
gWindow.resize(function(){
	gCanvas.width = gContainer.width();
	gCanvas.height= gContainer.height();
	if(gCanvas.width>=2000){
		gCanvas.width=2000;
	}
	if(gCanvas.height>=1200){
		gCanvas.height=1200;
	}
});
function OnAuth(){
	//1.player정보 요청
	//2.player가 위치한 맵정보 요청
	//2.맵을 읽으면서 맵안에 존재하는 이미지주소를 얻어와 gImageSrc에 등록
	//3.preload를 통해 자원로드
	//4.OnLoad()
	var map;
	var readyImage={
		max:0,
		now:0
	};

	var preloaded=false; //preload가 완료되면 true
	socket.emit("cRequestMapData",player.place.map);
	socket.on("sResponseMapData",function(res){
		if(res.result=="error"){
			switch(res.errorCode){
				default:
					//error처리
			}
			return;
		}
		map         =res.data;
		var temp={};
		var mapData =map.background._data;
		for(var i=0; i<mapData.length; i++){
			var imageId=mapData[i][2];
			if(temp[imageId]===true){
				continue;
			}
			temp[imageId]=true;
			readyImage.max++;
			socket.emit("cRequestImageData",imageId);
		}
		for(var i=0; i<map.things.length; i++){
			var imageId=map.things[i][2];
			if(temp[imageId]===true){
				continue;
			}
			temp[imageId]=true;
			readyImage.max++;
			socket.emit("cRequestImageData",imageId);	
		}
	});
	socket.on("sResponseImageData",function(res){
		if(res.result=="error"){
			switch(res.errorCode){
				default:
					//error처리
			}
			return;
		}
		var image=res.data;
		if(gImage[image.id]){
			return;
		}
		if(gImageSrc[image.src]===undefined){
			gImageSrc[image.src]=false;
		}
		gImage[image.id]   =image;

		//preload
		if(preloaded===false){
			if(readyImage.max==(++readyImage.now)){
				preload();
			}
		}
	});
	function preload(){
		var keys=Object.keys(gImageSrc);
		var loaded=0;
		for(var i=0; i<keys.length; i++){
			loadImage(keys[i],checkLoad);
		}
		function checkLoad(){
			loaded++;
			if(loaded==keys.length){
				preloaded=true;
				OnLoad();
			}
		}
	};
	var pressKey=[];
	function OnLoad(){
		$(".loading-cover").animate({top:gWindow.height()*-1,opacity:0.9},1000,function(){$(".loading-cover").hide();});
		window.requestAnimationFrame(Logic);
		window.onkeydown=function(e){
			var keyCode=e.keyCode;
			var now =(new Date()).getTime();
			switch(keyCode){
				case 38:
					if(pressKey[37]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"top,left"});
					}else if(pressKey[39]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"top,right"});
						break;
					}else{
						socket.emit("cRequestPlayerMove",{now:now,direction:"top"});
					}
					break;
				case 37:
					if(pressKey[38]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"top,left"});
					}else if(pressKey[40]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"bottom,left"});
						break;
					}else{
						socket.emit("cRequestPlayerMove",{now:now,direction:"left"});
					}
					break;
				case 40:
					if(pressKey[37]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"bootom,left"});
					}else if(pressKey[39]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"bottom,right"});
						break;
					}else{
						socket.emit("cRequestPlayerMove",{now:now,direction:"bottom"});
					}
					break;
				case 39:
					if(pressKey[38]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"top,right"});
					}else if(pressKey[40]){
						socket.emit("cRequestPlayerMove",{now:now,direction:"bottom,right"});
						break;
					}else{
						socket.emit("cRequestPlayerMove",{now:now,direction:"right"});
					}
					break;
			}
			pressKey[keyCode]=true;
		};
		window.onkeyup=function(e){
			socket.emit("cRequestClearPlayerMoving");
			pressKey[e.keyCode]=false;
		}
	}
	function Logic(){
		gCtx.clearRect(0,0,gCanvas.width,gCanvas.height);
		var x=player.place.pos.x+player.body.width/2,
			y=player.place.pos.y+player.body.height/2;

		drawMap(x,y);
		drawPlayer(x,y);

		window.requestAnimationFrame(Logic);
	}
	//socket
	//플레이어를 컨트롤 할 경우, 서버 처리 이후 클라이언트에게 업데이트된 플레이어 정보를 전송한다.
	//클라이언트는 이를(player 변수를) 비동기적으로 갱신한다.
	socket.on("sResponsePlayerData",function(res){
		if(res.result=="error"){
			//error
			return;
		}
		player=res.data;
	});
				

	socket.on("sResponsePlayerPlace",function(res){
		player.place=res;
	});
	socket.on("sResponseOtherPlayerPlace",function(res){
		var id=res.id;
		var place=res.place;
	});

	var cacheMap=[];
	function drawMap(x,y){
		var mW=map.background.width;
		var mH=map.background.height;
		var mD=map.background._data;
		var pX=x-gCanvas.width/2,
			pY=y-gCanvas.height/2;
		pX=pX<0 ? 0 : pX;
		pY=pY<0 ? 0 : pY;
		var cW=Math.ceil(gCanvas.width/tileSize);
		var cH=Math.ceil(gCanvas.height/tileSize);
		var sX=parseInt(pX/tileSize);
		var sY=parseInt(pY/tileSize);
		var eX=sX+cW+1;
		var eY=sY+cH+1;
		var bX=parseInt(pX%tileSize);
		var bY=parseInt(pY%tileSize);
		if(x>mW*tileSize-gCanvas.width/2){
			sX=mW-cW;
			eX=mW;
			bX=parseInt(cW*tileSize-gCanvas.width);
		}
		if(y>mH*tileSize-gCanvas.height/2){
			sY=mH-cH;
			eY=mH;
			bY=parseInt(cH*tileSize-gCanvas.height);
		}
		var iX=0,iY=0;
		for(var y=sY; y<eY; y++){
			iX=0;
			for(var x=sX; x<eX; x++){
				var index=y*mW+x;
				if(cacheMap[index]){
					var image=gImage[cacheMap[index]];
				}else{
					for(var i=0; i<mD.length; i++){
						if(mD[i][0]<=index && mD[i][1]>=index){
							var image=gImage[mD[i][2]];
							cacheMap[index]=mD[i][2];
						}
					}
				}
				gCtx.drawImage(gImages[image.src],image.sX,image.sY,tileSize,tileSize,iX*tileSize-bX,iY*tileSize-bY,tileSize,tileSize);
				iX++;
			}
			iY++;
		}
		for(var i=0; i<map.things.length; i++){
			var x=map.things[i][0],
				y=map.things[i][1];
			if(x>=pX && x<=pX+cW && y>=pY && y<=pY+cH){
				image=gImage[map.things[i][2]];
				gCtx.drawImage(gImages[image.src],image.sX,image.sY,image.width,image.height,(x-pX)*tileSize-bX,(y-pY)*tileSize-bY,image.width,image.height);
			}
		}
	}
	function drawPlayer(x,y){
		var bW=map.background.width*tileSize;
		var bH=map.background.height*tileSize;

		if(x<gCanvas.width/2){
			var dX=player.place.pos.x
		}else if(x>bW-gCanvas.width/2){
			var dX=gCanvas.width-(bW-player.place.pos.x);
		}else{
			var dX=gCanvas.width/2-player.body.width/2;
		}
     	if(y<gCanvas.height/2){
			var dY=wplayer.place.pos.y;
		}else if(y>bH-gCanvas.height/2){
			var dY=gCanvas.height-(bH-player.place.pos.y);
		}else{
			var dY=gCanvas.height/2-player.body.height/2;
		}
		gCtx.drawImage(gImages['player.png'],0,0,50,100,dX,dY,50,100);
	}
	function drawObject(x,y){
		
	}
}
