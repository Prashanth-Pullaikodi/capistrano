
node {
    stage "Create build output"
     withEnv([
      "PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH",
      "RBENV_SHELL=sh"
     ]){
    sh '''bundle''' 
     }
}
