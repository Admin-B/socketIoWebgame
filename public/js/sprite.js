function loadImage(src,callback){
	if(gImageSrc[src]===true){
		return;
	}
	gImages[src]=new Image();
	gImages[src].src=gResourcePath+"/images/"+src;
	gImages[src].onload=function(){
		if(typeof callback=="function"){
			callback.apply(this,[]);
		}
	}
	gImageSrc[src]=true;
	return true;
}