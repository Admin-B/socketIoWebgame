module.exports=function(){
	String.prototype.checkEmail=function(){
		re=/^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
		if(this.length<6 || !re.test(this)) {
			return false;
		}else{
			return true;
		}
	}
}