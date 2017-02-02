var express    = require("express");
var bodyParser =require("body-parser");
var session    =require("express-session");
/*express setting*/
app=express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
	secret:"sessionKey@",
	resave:false,
	saveUninitialized:true
}));
app.set("views",__dirname+'/public');
app.set('view engine','ejs');
app.engine('html',require('ejs').renderFile);
var httpServer=app.listen(80,function(){
	console.log("http서버에 정상적으로 접속 하였습니다.");
});
/*token*/
var jwt=require("jsonwebtoken");
var tokenKey="tokenKey";
/********************************************/
var MongoClient=require("mongodb").MongoClient;
var db,
	collection=new Object();
MongoClient.connect("mongodb://localhost:27017/GAME",function(err,m_db){
	if(err){
		throw err;
	}
	console.log(new Date()+"\n데이터베이스에 성공적으로 연결되었습니다.");
	db=m_db;
 	collection.map   =db.collection("Map");
 	collection.player=db.collection("Player");
 	collection.image =db.collection("Image");

	OnDB();
});

var players=[]; //온라인 된 플레이어
var map    =[];
var tileSize=64;

var SocketIdList={};

function OnDB(){
	collection.map.find({},{"background.width":1,"background.height":1,'people':1}).toArray(function(err,arr){
		map=arr;
	});
	app.get("/",function(req,res){
		if(!req.session.player){
			res.redirect("/login");
		}else{
			res.render("game.html",{
				_token:players[req.session.player]._token
			});
		}
	});
	app.get("/login",function(req,res){
		if(req.session.player){
			res.redirect("/");
			return;
		}
		res.render("login.html");
	});
	app.post("/api/login",function(req,res){
		var email=req.body.email,
			pass =req.body.password;
		if((typeof email=="string" && !email.checkEmail()) || typeof pass!="string"){
			Res_error(res);
			return;
		}
		collection.player.findOne({email:email,password:pass},function(err,doc){
			if(err) throw err;
			if(!doc){
				Res_error(res);
				return;
			}
			//로그인 성공 시
			//1.session에 회원 id,nickname을 저장한다.
			req.session.player    =doc.id

			//2.socket 통신에서는 session 에 접근하지 못하기 때문에,
			// players 배열(현재 로그인된 유저 목록)에 플레이어 정보입력후
			// token 키를 함께 저장한다.
			players[doc.id]       =doc;
			players[doc.id]._token=jwt.sign({id:doc.id},tokenKey,{
				algorithm : 'HS256',
				expiresIn:1440
			});

			//success
			Res_success(res);
		});
		return;
	});
	/*web socket*/
	var io  = require("socket.io").listen(httpServer);
	var socket;

	io.sockets.on('connection',function(socket){
		socket.on("cRequestAuth",function(token){
			var authData=jwt.verify(token,tokenKey);
			var auth=isPlayer(authData.id,token);
			if(auth){
				socket.emit("sResponseAuth",{result:"success",player:{
					id:auth.id,
					nickname:auth.nickname,
					place:auth.place,
					stat:auth.stat,
					body:auth.body
				}});
				//players[auth.id]._socket=socket.id;
				SocketIdList[socket.id]=auth.id;
				socket.join(auth.place.map);
			}else{
				socket.emit("sResponseAuth",{result:"error"});
			}
		});
		socket.on('disconnect',function(){
			var player  =players[SocketIdList[socket.id]];
			console.log(player);
			collection.player.update({id:player.id},{$set:{
				place:player.place,
				stat :player.stat,
				body :player.body,
				nickname:player.nickname
			}},function(err){
				if(err){
					throw err;
				}
			});
		});
		OnSocket(socket);
	});
	//player disconnect
	//player 정보를 db에 업데이트

	function OnSocket(socket){
		socket.on("cRequestMapData",function(id){
			if(isNaN(id=Number(id))){
				socket.emit("sResponseMapData",{
					result:"error",
					errorCode:0001
				});
				return;
			}
			collection.map.findOne({id:id},function(err,doc){
				if(err){
					socket.emit("sResponseMapData",{
						result:"error",
						errorCode:0002
					});
					throw err;
				}
				socket.emit("sResponseMapData",{
					result:"success",
					data:doc
				});
			});
		});
		socket.on("cRequestImageData",function(id){
			if(isNaN(id=Number(id))){
				socket.emit("sResponseImageData",{
					result:"error",
					errorCode:0010
				});
				return;
			}
			collection.image.findOne({id:id},function(err,doc){
				if(err){
					socket.emit("sResponseImageData",{
						result:"error",
						errorCode:0011
					});
					throw err;		
				}
				socket.emit("sResponseImageData",{
					result:"success",
					data:doc
				});
			});
		});

		socket.on("cRequestPlayerMove",function(data){
			var player=players[SocketIdList[socket.id]];
			var now =data.now;
			var time=player.moving ? (now-player.moving)/1000:1/1000;
			if(time>=1/20 || time<=-1/20){
				delete player.moving;
				return;
			}
			var direction=data.direction;
			var nPos=player.place.pos;
			var prevPos={
				x:parseInt(nPos.x),
				y:parseInt(nPos.y)
			};
			var speed=player.stat.speed*time;
			var sqrtSpeed=Math.sqrt(speed*2);
			switch(direction){
				case "top":
					nPos.y+=-speed;
					break;
				case "top,left":
					nPos.y+=-sqrtSpeed;
					nPos.x+=-sqrtSpeed;
					break;
				case "top,right":
					nPos.y+=-sqrtSpeed;
					nPos.x+=sqrtSpeed;
					break
				case "bottom":
					nPos.y+=speed;
					break;
				case "bottom,left":
					nPos.y+=sqrtSpeed;
					nPos.x+=-sqrtSpeed;
					break;
				case "bottom,right":
					nPos.y+=sqrtSpeed;
					nPos.x+=sqrtSpeed;
					break;
				case "left":
					nPos.x+=-speed;
					break;
				case "right":
					nPos.x+=speed;
					break;
				default:
					delete player.moving;
					return;
			}
			if(Math.abs(prevPos.x-nPos.x)>=1 || Math.abs(prevPos.y-nPos.y)>=1){
				socket.emit("sResponsePlayerPlace",player.place);
				io.sockets.in(player.place.map).emit("sResponseOtherPlayerPlace",{id:player.id,place:player.place});
			}
			player.moving   =now;
		});
		socket.on("cRequestClearPlayerMoving",function(){
			delete players[SocketIdList[socket.id]].moving;
		});
	}
}
function isPlayer(id,token){
	if(isNaN(id)){
		return false;
	}
	if(players[id]._token==token){
		return players[id];
	}
	return false;
}
function Res_success(res,info){
	if(!info){
		info={};
	}
	info.result="success";
	res.end(JSON.stringify(info));
}
function Res_error(res,info){
	if(!info){
		info={};
	}
	info.result="error";
	res.end(JSON.stringify(info));
}
require("./string.js")();